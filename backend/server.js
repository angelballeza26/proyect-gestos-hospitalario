const express = require('express');
const session = require('express-session');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const dbPath = path.join(__dirname, '..', 'database', 'hospital.db');
for (const extra of ['hospital.db', 'hospital.db-shm', 'hospital.db-wal']) {
  try { fs.rmSync(path.join(__dirname, '..', 'database', extra)); } catch (error) {}
}
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(session({
  secret: process.env.SESSION_SECRET || 'hospital-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, sameSite: 'lax' }
}));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  const seed = fs.readFileSync(path.join(__dirname, '..', 'database', 'seed.sql'), 'utf8');
  db.exec(schema);

  const roleCount = db.prepare('SELECT COUNT(*) AS count FROM roles').get().count;
  if (roleCount === 0) {
    db.exec(seed);
  }

  const existingAdmin = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
  if (!existingAdmin) {
    const passwordHash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (full_name, username, email, password_hash, role, specialty) VALUES (?, ?, ?, ?, ?, ?)')
      .run('Admin General', 'admin', 'admin@hospital.local', passwordHash, 'general', 'Administración');
  }
}

initDb();

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  next();
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    next();
  };
}

app.get('/api/roles', (req, res) => {
  const roles = db.prepare('SELECT * FROM roles ORDER BY id').all();
  res.json(roles);
});

app.post('/api/register', (req, res) => {
  const { full_name, username, password, role, specialty, email } = req.body;
  if (!full_name || !username || !password || !role) {
    return res.status(400).json({ error: 'Completa todos los campos obligatorios' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email || null);
  if (existing) {
    return res.status(409).json({ error: 'El usuario ya existe' });
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (full_name, username, password_hash, role, specialty, email) VALUES (?, ?, ?, ?, ?, ?)')
    .run(full_name, username, passwordHash, role, specialty || null, email || null);
  const user = db.prepare('SELECT id, full_name AS fullName, username, role, specialty, email FROM users WHERE id = ?').get(result.lastInsertRowid);
  req.session.user = { id: user.id, name: user.fullName, username: user.username, role: user.role, specialty: user.specialty, email: user.email };
  res.json({ success: true, user: req.session.user });
});

app.post('/api/login', (req, res) => {
  const { username, password, email } = req.body;
  const lookup = (username || email || '').trim();
  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(lookup, lookup);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  req.session.user = { id: user.id, name: user.full_name, username: user.username, role: user.role, specialty: user.specialty, email: user.email };
  res.json({ success: true, user: req.session.user });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.session.user });
});

app.get('/api/dashboard', requireAuth, (req, res) => {
  const hospitalized = db.prepare("SELECT COUNT(*) AS count FROM patients WHERE status = 'Hospitalizado'").get().count;
  const urgencias = db.prepare("SELECT COUNT(*) AS count FROM patients WHERE area = 'Urgencias'").get().count;
  const quirurgico = db.prepare("SELECT COUNT(*) AS count FROM patients WHERE area = 'Quirófano'").get().count;
  const images = db.prepare("SELECT COUNT(*) AS count FROM patients WHERE area IN ('Rayos X','Tomografía','Resonancia')").get().count;
  const available = db.prepare("SELECT COUNT(*) AS count FROM equipment WHERE status = 'Disponible'").get().count;
  const maintenance = db.prepare("SELECT COUNT(*) AS count FROM equipment WHERE status = 'En mantenimiento'").get().count;
  const patients = db.prepare('SELECT * FROM patients ORDER BY admission_date DESC LIMIT 6').all();
  const equipment = db.prepare('SELECT * FROM equipment ORDER BY created_at DESC LIMIT 6').all();
  res.json({ hospitalized, urgencias, quirurgico, images, available, maintenance, patients, equipment });
});

app.get('/api/patients', requireAuth, requireRole(['general','nurse','doctor','administrative','admin']), (req, res) => {
  const { q = '', area = '', status = '', floor = '' } = req.query;
  let sql = 'SELECT * FROM patients WHERE 1=1';
  const params = [];
  if (q) {
    sql += ' AND (first_name LIKE ? OR last_name LIKE ? OR dni LIKE ? OR reason LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (area) {
    sql += ' AND area = ?';
    params.push(area);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (floor) {
    sql += ' AND floor = ?';
    params.push(floor);
  }
  sql += ' ORDER BY created_at DESC';
  const patients = db.prepare(sql).all(...params);
  res.json(patients);
});

app.get('/api/patients/:id', requireAuth, requireRole(['general','nurse','doctor','administrative','admin']), (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });
  res.json(patient);
});

app.get('/api/patients/:id/profile', requireAuth, requireRole(['general','nurse','doctor','administrative','admin']), (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });
  const movements = db.prepare('SELECT * FROM patient_movements WHERE patient_id = ? ORDER BY moved_at DESC').all(req.params.id);
  const notes = db.prepare('SELECT * FROM patient_notes WHERE patient_id = ? ORDER BY created_at DESC').all(req.params.id);
  const documents = db.prepare('SELECT * FROM patient_documents WHERE patient_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json({ patient, movements, notes, documents });
});

app.post('/api/patients', requireAuth, requireRole(['general','nurse','administrative','admin']), (req, res) => {
  const { first_name, last_name, dni, birth_date, gender, phone, address, allergies, background, reason, area = 'Urgencias', status = 'En Espera', floor = 'Piso 1', room = '', bed = '', assigned_doctor = '', diagnosis = '', photo_url = '', cover_url = '' } = req.body;
  const result = db.prepare(`
    INSERT INTO patients (first_name, last_name, dni, birth_date, gender, phone, address, allergies, background, reason, area, floor, status, room, bed, assigned_doctor, diagnosis, photo_url, cover_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(first_name, last_name, dni, birth_date, gender, phone, address, allergies, background, reason, area, floor, status, room, bed, assigned_doctor, diagnosis, photo_url, cover_url);
  const patientId = result.lastInsertRowid;
  db.prepare('INSERT INTO patient_movements (patient_id, from_area, to_area, from_status, to_status, user_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(patientId, 'Registro', area, 'Registro', status, req.session.user.id, 'Registro inicial del paciente');
  res.json({ success: true, patient: { id: patientId } });
});

app.put('/api/patients/:id', requireAuth, requireRole(['general','nurse','doctor','administrative','admin']), (req, res) => {
  const { first_name, last_name, dni, birth_date, gender, phone, address, allergies, background, reason, diagnosis, area, floor, status, room, bed, assigned_doctor, photo_url, cover_url } = req.body;
  db.prepare(`
    UPDATE patients
    SET first_name = ?, last_name = ?, dni = ?, birth_date = ?, gender = ?, phone = ?, address = ?, allergies = ?, background = ?, reason = ?, diagnosis = ?, area = ?, floor = ?, status = ?, room = ?, bed = ?, assigned_doctor = ?, photo_url = ?, cover_url = ?
    WHERE id = ?
  `).run(first_name, last_name, dni, birth_date, gender, phone, address, allergies, background, reason, diagnosis, area, floor, status, room, bed, assigned_doctor, photo_url, cover_url, req.params.id);
  res.json({ success: true });
});

app.post('/api/patients/:id/notes', requireAuth, requireRole(['general','nurse','doctor','admin']), (req, res) => {
  const { title, content } = req.body;
  const result = db.prepare('INSERT INTO patient_notes (patient_id, title, content, created_by) VALUES (?, ?, ?, ?)')
    .run(req.params.id, title, content, req.session.user.id);
  res.json({ success: true, note: { id: result.lastInsertRowid } });
});

app.post('/api/patients/:id/procedures', requireAuth, requireRole(['general','nurse','doctor','admin']), (req, res) => {
  const { title, content } = req.body;
  db.prepare('INSERT INTO patient_notes (patient_id, title, content, created_by) VALUES (?, ?, ?, ?)')
    .run(req.params.id, title || 'Procedimiento', content, req.session.user.id);
  res.json({ success: true });
});

app.post('/api/patients/:id/documents', requireAuth, requireRole(['general','nurse','doctor','admin']), (req, res) => {
  const { title, file_url, notes } = req.body;
  db.prepare('INSERT INTO patient_documents (patient_id, title, file_url, notes) VALUES (?, ?, ?, ?)')
    .run(req.params.id, title, file_url || '', notes || '');
  res.json({ success: true });
});

app.post('/api/patients/:id/move', requireAuth, requireRole(['general','nurse','doctor','administrative','admin']), (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });
  const { area, status, floor, room, bed, assigned_doctor, notes } = req.body;
  db.prepare('UPDATE patients SET area=?, status=?, floor=?, room=?, bed=?, assigned_doctor=? WHERE id=?')
    .run(area, status, floor || patient.floor, room || patient.room, bed || patient.bed, assigned_doctor || patient.assigned_doctor, req.params.id);
  db.prepare('INSERT INTO patient_movements (patient_id, from_area, to_area, from_status, to_status, user_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(req.params.id, patient.area, area, patient.status, status, req.session.user.id, notes || 'Movimiento realizado desde la interfaz');
  res.json({ success: true });
});

app.get('/api/patients/:id/movements', requireAuth, requireRole(['general','nurse','doctor','administrative','admin']), (req, res) => {
  const movements = db.prepare(`
    SELECT pm.*, u.full_name AS user_name
    FROM patient_movements pm
    LEFT JOIN users u ON u.id = pm.user_id
    WHERE pm.patient_id = ?
    ORDER BY pm.moved_at DESC
  `).all(req.params.id);
  res.json(movements);
});

app.get('/api/equipment', requireAuth, requireRole(['general','engineer','administrative','admin']), (req, res) => {
  const { status = '', type = '' } = req.query;
  let sql = 'SELECT * FROM equipment WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (type) { sql += ' AND type = ?'; params.push(type); }
  sql += ' ORDER BY created_at DESC';
  const equipment = db.prepare(sql).all(...params);
  res.json(equipment);
});

app.post('/api/equipment', requireAuth, requireRole(['general','engineer','admin']), (req, res) => {
  const { name, code, type, brand, model, status, location, acquisition_date, area, patient_id } = req.body;
  const result = db.prepare(`
    INSERT INTO equipment (name, code, type, brand, model, status, location, acquisition_date, area, patient_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, code, type, brand, model, status || 'Disponible', location || '', acquisition_date, area || '', patient_id || null);
  res.json({ success: true, equipment: { id: result.lastInsertRowid } });
});

app.put('/api/equipment/:id', requireAuth, requireRole(['general','engineer','admin']), (req, res) => {
  const { name, code, type, brand, model, status, location, acquisition_date, area, patient_id } = req.body;
  db.prepare(`
    UPDATE equipment
    SET name = ?, code = ?, type = ?, brand = ?, model = ?, status = ?, location = ?, acquisition_date = ?, area = ?, patient_id = ?
    WHERE id = ?
  `).run(name, code, type, brand, model, status || 'Disponible', location || '', acquisition_date, area || '', patient_id || null, req.params.id);
  res.json({ success: true });
});

app.delete('/api/equipment/:id', requireAuth, requireRole(['general','engineer','admin']), (req, res) => {
  db.prepare('DELETE FROM equipment WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/equipment/:id/assign', requireAuth, requireRole(['general','engineer','admin']), (req, res) => {
  const { patient_id, status } = req.body;
  db.prepare('UPDATE equipment SET patient_id = ?, status = ? WHERE id = ?').run(patient_id || null, status || 'En uso', req.params.id);
  res.json({ success: true });
});

app.post('/api/equipment/:id/maintenance', requireAuth, requireRole(['general','engineer','admin']), (req, res) => {
  const { maintenance_date, type, next_maintenance, notes } = req.body;
  db.prepare('INSERT INTO equipment_maintenance (equipment_id, maintenance_date, type, next_maintenance, notes) VALUES (?, ?, ?, ?, ?)')
    .run(req.params.id, maintenance_date, type, next_maintenance, notes);
  res.json({ success: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.listen(port, () => {
  console.log(`Servidor en http://localhost:${port}`);
});
