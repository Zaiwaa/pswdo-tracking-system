const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required.');

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
});

async function query(text, params) {
  return pool.query(text, params);
}

async function initDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      position TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'User',
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS documents (
      id UUID PRIMARY KEY,
      reference_number TEXT UNIQUE NOT NULL,
      program_unit TEXT NOT NULL,
      document_type TEXT NOT NULL,
      document_description TEXT NOT NULL,
      amount NUMERIC,
      date_created DATE NOT NULL,
      assigned_liaison TEXT,
      current_status TEXT NOT NULL DEFAULT 'Not yet routed',
      progress_percent INTEGER NOT NULL DEFAULT 0,
      approval_state TEXT NOT NULL DEFAULT 'Pending',
      remarks_history JSONB NOT NULL DEFAULT '[]'::jsonb,
      attachment_link TEXT,
      routing JSONB NOT NULL DEFAULT '[]'::jsonb,
      checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      public_token UUID UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS routing_history (
      id BIGSERIAL PRIMARY KEY,
      document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      reference_number TEXT NOT NULL,
      checkpoint TEXT NOT NULL,
      event_timestamp TEXT,
      assigned_liaison TEXT,
      remarks TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS deletion_requests (
      id UUID PRIMARY KEY,
      requester_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      target_type TEXT NOT NULL CHECK (target_type IN ('history','remark')),
      target_key TEXT NOT NULL,
      target_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
      reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
      review_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_public_token ON documents(public_token);
    CREATE INDEX IF NOT EXISTS idx_audit_document_created ON audit_logs(document_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_deletion_requests_status_created ON deletion_requests(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_deletion_requests_document ON deletion_requests(document_id, created_at DESC);
  `);

  // Safe migrations for databases created by older versions.
  await query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS public_token UUID');
  await query('UPDATE documents SET public_token = gen_random_uuid() WHERE public_token IS NULL');
  await query('ALTER TABLE documents ALTER COLUMN public_token SET NOT NULL');
  await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_public_token ON documents(public_token)');

  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = String(process.env.ADMIN_PASSWORD || '');
  if (adminEmail && adminPassword) {
    const existing = await query('SELECT id FROM users WHERE email=$1', [adminEmail]);
    if (!existing.rowCount) {
      const hash = await bcrypt.hash(adminPassword, 12);
      await query(
        `INSERT INTO users(id,full_name,email,position,role,password_hash,status)
         VALUES($1,$2,$3,$4,'Administrator',$5,'Active')`,
        [uuidv4(), process.env.ADMIN_NAME || 'System Administrator', adminEmail,
         process.env.ADMIN_POSITION || 'System Administrator', hash]
      );
      console.log(`Seeded administrator: ${adminEmail}`);
    }
  }
}

module.exports = { pool, query, initDb };
