require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding Railway database...');

    // Run schema first
    const fs = require('fs');
    const schema = fs.readFileSync('./schema.sql', 'utf8');
    await client.query(schema);
    await client.query(`ALTER TABLE modules ADD COLUMN IF NOT EXISTS section VARCHAR(20) DEFAULT 'modules'`);

    // Clear existing data
    await client.query('DELETE FROM lessons');
    await client.query('DELETE FROM modules');
    await client.query('SELECT setval(pg_get_serial_sequence(\'modules\',\'id\'), 1, false)');
    await client.query('SELECT setval(pg_get_serial_sequence(\'lessons\',\'id\'), 1, false)');

    // Insert nav modules
    const navModules = [
      { title: 'Grading and Logistics', description: 'Course grading policy and logistics overview', icon: '📋', color: '#0891b2', section: 'nav', order_index: 1 },
      { title: 'Online Learning Navigation', description: 'How to navigate the online learning environment', icon: '🖥️', color: '#0891b2', section: 'nav', order_index: 2 },
      { title: 'Needs Analysis Test', description: 'Initial assessment of your communication needs', icon: '📝', color: '#0891b2', section: 'nav', order_index: 3 },
      { title: 'Introductory Video', description: 'Welcome and course introduction', icon: '🎬', color: '#0891b2', section: 'nav', order_index: 4 },
      { title: 'Course Syllabus', description: 'Full course syllabus and schedule', icon: '📄', color: '#0891b2', section: 'nav', order_index: 5 },
    ];

    // Insert course modules
    const courseModules = [
      { title: 'Module 1: Foundations of Professional Communication', description: 'Building the foundations of professional communication', icon: '📖', color: '#2563eb', section: 'modules', order_index: 1 },
      { title: 'Module 2: Professional Register and Instructional Language', description: 'Understanding professional register and instructional language', icon: '📖', color: '#7c3aed', section: 'modules', order_index: 2 },
      { title: 'Module 3: Digital Communication in the EFL Classroom', description: 'Digital communication tools and strategies for EFL teachers', icon: '📖', color: '#0891b2', section: 'modules', order_index: 3 },
      { title: 'Module 4: Intercultural Communication (ICC) of EFL Teachers', description: 'Intercultural communication competence for EFL teachers', icon: '📖', color: '#16a34a', section: 'modules', order_index: 4 },
    ];

    const allModules = [...navModules, ...courseModules];
    const moduleIds = {};

    for (const m of allModules) {
      const r = await client.query(
        `INSERT INTO modules (title, description, icon, color, section, order_index, status) VALUES ($1,$2,$3,$4,$5,$6,'published') RETURNING id`,
        [m.title, m.description, m.icon, m.color, m.section, m.order_index]
      );
      moduleIds[m.title] = r.rows[0].id;
      console.log(`  ✅ Module: ${m.title} (id=${r.rows[0].id})`);
    }

    // Lessons per module
    const lessonsByModule = {
      'Module 1: Foundations of Professional Communication': [
        { title: 'Learning goal', type: 'reading', order_index: 1 },
        { title: 'SCENARIO 1: Disruptive classroom', type: 'video', video_url: 'https://www.youtube.com/watch?v=CbPy_CjJR90&list=PL2IkMHFHWdEqi0jiLXTEakULNDXGc-q_B', duration: '12:30', order_index: 2 },
        { title: 'Check Your Understanding: 1', type: 'assignment', order_index: 3 },
        { title: 'QUIZ 1 PEDAGOGICAL JUSTIFICATION', type: 'quiz', order_index: 4 },
        { title: 'Test Your Understanding', type: 'quiz', order_index: 5 },
        { title: 'Core Lecture Videos', type: 'video', order_index: 6 },
        { title: 'DIAGNOSTIC TEST: Self-Assessment', type: 'quiz', order_index: 7 },
        { title: 'Peer Reflection - Forum activity', type: 'assignment', order_index: 8 },
        { title: 'FINAL PROJECT', type: 'assignment', order_index: 9 },
      ],
      'Module 2: Professional Register and Instructional Language': [
        { title: 'Learning goal', type: 'reading', order_index: 1 },
        { title: 'SCENARIO 2: WRONG INSTRUCTIONS', type: 'video', order_index: 2 },
        { title: 'Check Your Understanding: 2', type: 'assignment', order_index: 3 },
        { title: 'Core Lecture Videos', type: 'video', order_index: 4 },
        { title: 'Test Your Understanding', type: 'quiz', order_index: 5 },
        { title: 'Peer Reflection - Forum activity', type: 'assignment', order_index: 6 },
        { title: 'FINAL PROJECT module 2', type: 'assignment', order_index: 7 },
      ],
      'Module 3: Digital Communication in the EFL Classroom': [
        { title: 'Learning goal', type: 'reading', order_index: 1 },
        { title: 'SCENARIO 3', type: 'video', order_index: 2 },
        { title: 'Core Lecture Videos module 3', type: 'video', order_index: 3 },
        { title: 'Peer Reflection - Forum activity', type: 'assignment', order_index: 4 },
        { title: 'Check Your Understanding: 3', type: 'assignment', order_index: 5 },
        { title: 'FINAL PROJECT 3', type: 'assignment', order_index: 6 },
      ],
      'Module 4: Intercultural Communication (ICC) of EFL Teachers': [
        { title: 'Learning goal', type: 'reading', order_index: 1 },
        { title: 'SCENARIO 4', type: 'video', order_index: 2 },
        { title: 'Core Lecture Videos module 4', type: 'video', order_index: 3 },
        { title: 'Check your understanding', type: 'assignment', order_index: 4 },
        { title: 'Peer reflection - Forum activity', type: 'assignment', order_index: 5 },
        { title: 'Final project', type: 'assignment', order_index: 6 },
        { title: 'DIAGNOSTIC POST TEST', type: 'quiz', order_index: 7 },
      ],
    };

    for (const [moduleName, lessons] of Object.entries(lessonsByModule)) {
      const moduleId = moduleIds[moduleName];
      for (const l of lessons) {
        await client.query(
          `INSERT INTO lessons (module_id, title, type, video_url, duration, order_index) VALUES ($1,$2,$3,$4,$5,$6)`,
          [moduleId, l.title, l.type, l.video_url || null, l.duration || null, l.order_index]
        );
      }
      console.log(`  ✅ Lessons seeded for: ${moduleName}`);
    }

    console.log('🎉 Done! Database seeded successfully.');
  } catch (err) {
    console.error('❌ Seed error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
