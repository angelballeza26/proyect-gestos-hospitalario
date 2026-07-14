CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('general','nurse','doctor','engineer','administrative','admin')),
  specialty TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  dni TEXT UNIQUE NOT NULL,
  birth_date TEXT NOT NULL,
  gender TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  allergies TEXT,
  background TEXT,
  reason TEXT,
  diagnosis TEXT,
  photo_url TEXT,
  cover_url TEXT,
  admission_date TEXT DEFAULT CURRENT_TIMESTAMP,
  area TEXT NOT NULL DEFAULT 'En Espera',
  floor TEXT NOT NULL DEFAULT 'Piso 1',
  status TEXT NOT NULL DEFAULT 'En Espera' CHECK(status IN ('En Espera','Sala de Espera','En Consulta','En Quirófano','En Observación Post-Quirúrgica','En Rayos X','En Tomógrafo','En Resonancia Magnética','Hospitalizado','Alta Médica','Referido','Trasladado')),
  room TEXT,
  bed TEXT,
  assigned_doctor TEXT,
  discharge_date TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patient_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  from_area TEXT,
  to_area TEXT,
  from_status TEXT,
  to_status TEXT,
  user_id INTEGER,
  notes TEXT,
  moved_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS patient_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS patient_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  file_url TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'Disponible' CHECK(status IN ('Disponible','En uso','En mantenimiento','Con falla','Averiado')),
  location TEXT,
  acquisition_date TEXT NOT NULL,
  area TEXT,
  patient_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS equipment_maintenance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id INTEGER NOT NULL,
  maintenance_date TEXT NOT NULL,
  type TEXT NOT NULL,
  next_maintenance TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
);
