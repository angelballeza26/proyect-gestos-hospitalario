INSERT INTO roles (name, description) VALUES
('general', 'Administrador general'),
('nurse', 'Enfermería'),
('doctor', 'Médico'),
('engineer', 'Ingeniería biomédica'),
('administrative', 'Administrativo');

INSERT INTO users (full_name, username, email, password_hash, role, specialty) VALUES
('Admin General', 'admin', 'admin@hospital.local', '$2a$10$5ffiAMVd4AI6th9CV0YTXuQtPqVVbtpEuAVRqTEzHc1ewof349mTq', 'general', 'Administración'),
('Dra. Ana Rivera', 'ana', 'ana@hospital.local', '$2a$10$5ffiAMVd4AI6th9CV0YTXuQtPqVVbtpEuAVRqTEzHc1ewof349mTq', 'doctor', 'Medicina General'),
('Enf. Carla Díaz', 'carla', 'carla@hospital.local', '$2a$10$5ffiAMVd4AI6th9CV0YTXuQtPqVVbtpEuAVRqTEzHc1ewof349mTq', 'nurse', 'Urgencias'),
('Ing. Marco Soto', 'marco', 'marco@hospital.local', '$2a$10$5ffiAMVd4AI6th9CV0YTXuQtPqVVbtpEuAVRqTEzHc1ewof349mTq', 'engineer', 'Biomedicina');

INSERT INTO patients (first_name, last_name, dni, birth_date, gender, phone, address, allergies, background, reason, diagnosis, photo_url, cover_url, admission_date, area, floor, status, room, bed, assigned_doctor) VALUES
('María', 'García', '12345678', '1985-04-10', 'Femenino', '998877665', 'Av. Central 123', 'Penicilina', 'Hipertensión', 'Dolor abdominal', 'Colecistitis aguda', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80', 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1200&q=80', '2026-07-10', 'Urgencias', 'Piso 1', 'Hospitalizado', 'PISO-2', 'B-12', 'Dra. Ana Rivera'),
('Luis', 'Pérez', '87654321', '1979-11-02', 'Masculino', '912345678', 'Calle Lima 456', 'Ninguna', 'Diabetes', 'Fiebre persistente', 'Infección respiratoria', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80', 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1200&q=80', '2026-07-09', 'Sala de Espera', 'Piso 1', 'En Espera', 'PISO-1', 'A-03', 'Dra. Ana Rivera'),
('Ana', 'Torres', '11223344', '1992-01-20', 'Femenino', '955667788', 'Jr. San Martín 88', 'Aspirina', 'Asma', 'Control postquirúrgico', 'Postoperatorio', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80', 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=1200&q=80', '2026-06-28', 'Quirófano', 'Piso 2', 'En Quirófano', 'Q-02', 'C-09', 'Dra. Ana Rivera');

INSERT INTO patient_movements (patient_id, from_area, to_area, from_status, to_status, user_id, notes) VALUES
(1, 'Registro', 'Urgencias', 'Registro', 'Hospitalizado', 2, 'Ingreso inicial'),
(2, 'Registro', 'Sala de Espera', 'Registro', 'En Espera', 3, 'Asignación de espera'),
(3, 'Registro', 'Quirófano', 'Registro', 'En Quirófano', 2, 'Traslado a quirófano');

INSERT INTO patient_notes (patient_id, title, content, created_by) VALUES
(1, 'Observación inicial', 'Paciente estable, seguimiento por dolor abdominal persistente.', 2),
(2, 'Seguimiento', 'Se mantiene afebril y con control de glucosa.', 3);

INSERT INTO equipment (name, code, type, brand, model, status, location, acquisition_date, area, patient_id) VALUES
('Monitor multiparámetro', 'EQ-1001', 'Monitor', 'Philips', 'MX450', 'En uso', 'UCI', '2023-03-05', 'Urgencias', 1),
('Bomba de infusión', 'EQ-1002', 'Infusión', 'B Braun', 'Infusomat', 'Disponible', 'Sala de Hospitalización', '2022-09-12', 'Piso 2', NULL),
('Tomógrafo portátil', 'EQ-1003', 'Imágenes', 'GE', 'P-10', 'En mantenimiento', 'Mantenimiento', '2021-11-16', 'Rayos X', NULL),
('Ventilador portátil', 'EQ-1004', 'Respiratorio', 'ResMed', 'V-200', 'Con falla', 'Urgencias', '2024-01-10', 'Urgencias', NULL),
('Desfibrilador', 'EQ-1005', 'Emergencia', 'Zoll', 'X-series', 'Averiado', 'Emergencias', '2022-07-18', 'Urgencias', NULL);

INSERT INTO equipment_maintenance (equipment_id, maintenance_date, type, next_maintenance, notes) VALUES
(3, '2026-06-20', 'Preventivo', '2026-12-20', 'Cambio de filtros y revisión del sistema.');
