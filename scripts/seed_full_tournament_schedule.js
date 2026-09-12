require('dotenv').config();
const { query } = require('../config/postgres');

async function seedFullTournamentSchedule() {
  console.log('🏸 Starting full tournament schedule generation for 64 teams...');

  // 1. Fetch all registered teams
  const regRes = await query("SELECT reg_id, category, p1_name, p2_name FROM registrations ORDER BY created_at ASC");
  const bRegs = regRes.rows.filter(r => (r.category || '').toLowerCase().includes('below'));
  const aRegs = regRes.rows.filter(r => (r.category || '').toLowerCase().includes('above'));

  console.log(`Found ${bRegs.length} Below 35 teams and ${aRegs.length} Above 35 teams.`);

  // 2. Clear old mock matches (delete matches not part of standard structure)
  await query("DELETE FROM matches WHERE match_id IN ('M01', 'M02', 'M03', 'M-B35-01', 'M-B35-02', 'M-A35-01', 'M-A35-02', 'Court 1')");
  console.log('✅ Cleaned up old mock matches from database.');

  const timesR32 = [
    '09:00 AM', '09:40 AM', '10:20 AM', '11:00 AM',
    '11:40 AM', '12:20 PM', '01:00 PM', '01:40 PM',
    '02:20 PM', '03:00 PM', '03:40 PM', '04:20 PM',
    '05:00 PM', '05:40 PM', '06:20 PM', '07:00 PM'
  ];

  const timesR16 = [
    '10:00 AM', '10:45 AM', '11:30 AM', '12:15 PM',
    '01:00 PM', '01:45 PM', '02:30 PM', '03:15 PM'
  ];

  const timesQF = ['04:00 PM', '04:45 PM', '05:30 PM', '06:15 PM'];
  const timesSF = ['10:00 AM', '11:15 AM'];

  const allFixtures = [];

  function generateCategoryFixtures(catName, prefix, teamList) {
    // 16 Round of 32 matches
    for (let i = 1; i <= 16; i++) {
      const idx = i - 1;
      const t1 = teamList[idx * 2] || { p1_name: `Team ${idx * 2 + 1} P1`, p2_name: `Team ${idx * 2 + 1} P2`, reg_id: '' };
      const t2 = teamList[idx * 2 + 1] || { p1_name: `Team ${idx * 2 + 2} P1`, p2_name: `Team ${idx * 2 + 2} P2`, reg_id: '' };
      const p1 = `${t1.p1_name} / ${t1.p2_name}`;
      const p2 = `${t2.p1_name} / ${t2.p2_name}`;
      const court = (i % 2 === 1) ? 'Court 1' : 'Court 2';
      const time = timesR32[idx] || '09:00 AM';
      const nextNum = Math.ceil(i / 2);
      const nextSlot = (i % 2 === 1) ? 1 : 2;

      allFixtures.push({
        matchId: `${prefix}M${String(i).padStart(2, '0')}`,
        id: `${prefix}M${String(i).padStart(2, '0')}`,
        category: catName,
        round: 'Round of 32',
        day: 'Day 1',
        date: '28 Oct 2026',
        court,
        time,
        scheduledTime: time,
        pair1: p1,
        pair2: p2,
        team1Name: p1,
        team2Name: p2,
        team1P1: p1,
        team2P1: p2,
        team1Id: t1.reg_id,
        team2Id: t2.reg_id,
        nextMatchId: `${prefix}R16-M${String(nextNum).padStart(2, '0')}`,
        nextMatchSlot: nextSlot,
        status: 'UPCOMING',
        winner: '',
        scores: [],
        sets: []
      });
    }

    // 8 Round of 16 matches (Day 2)
    for (let i = 1; i <= 8; i++) {
      const idx = i - 1;
      const prev1 = (i * 2 - 1);
      const prev2 = (i * 2);
      const p1 = `Winner ${prefix}M${String(prev1).padStart(2, '0')}`;
      const p2 = `Winner ${prefix}M${String(prev2).padStart(2, '0')}`;
      const court = (i % 2 === 1) ? 'Court 1' : 'Court 2';
      const time = timesR16[idx] || '10:00 AM';
      const nextNum = Math.ceil(i / 2);
      const nextSlot = (i % 2 === 1) ? 1 : 2;

      allFixtures.push({
        matchId: `${prefix}R16-M${String(i).padStart(2, '0')}`,
        id: `${prefix}R16-M${String(i).padStart(2, '0')}`,
        category: catName,
        round: 'Round of 16',
        day: 'Day 2',
        date: '29 Oct 2026',
        court,
        time,
        scheduledTime: time,
        pair1: p1,
        pair2: p2,
        team1Name: p1,
        team2Name: p2,
        team1P1: p1,
        team2P1: p2,
        team1Id: '',
        team2Id: '',
        nextMatchId: `${prefix}QF-M${String(nextNum).padStart(2, '0')}`,
        nextMatchSlot: nextSlot,
        status: 'UPCOMING',
        winner: '',
        scores: [],
        sets: []
      });
    }

    // 4 Quarter-Final matches (Day 2)
    for (let i = 1; i <= 4; i++) {
      const idx = i - 1;
      const prev1 = (i * 2 - 1);
      const prev2 = (i * 2);
      const p1 = `Winner ${prefix}R16-M${String(prev1).padStart(2, '0')}`;
      const p2 = `Winner ${prefix}R16-M${String(prev2).padStart(2, '0')}`;
      const court = (i % 2 === 1) ? 'Court 1' : 'Court 2';
      const time = timesQF[idx] || '04:00 PM';
      const nextNum = Math.ceil(i / 2);
      const nextSlot = (i % 2 === 1) ? 1 : 2;

      allFixtures.push({
        matchId: `${prefix}QF-M${String(i).padStart(2, '0')}`,
        id: `${prefix}QF-M${String(i).padStart(2, '0')}`,
        category: catName,
        round: 'Quarter-Final',
        day: 'Day 2',
        date: '29 Oct 2026',
        court,
        time,
        scheduledTime: time,
        pair1: p1,
        pair2: p2,
        team1Name: p1,
        team2Name: p2,
        team1P1: p1,
        team2P1: p2,
        team1Id: '',
        team2Id: '',
        nextMatchId: `${prefix}SF-M${String(nextNum).padStart(2, '0')}`,
        nextMatchSlot: nextSlot,
        status: 'UPCOMING',
        winner: '',
        scores: [],
        sets: []
      });
    }

    // 2 Semi-Final matches (Day 3)
    for (let i = 1; i <= 2; i++) {
      const idx = i - 1;
      const prev1 = (i * 2 - 1);
      const prev2 = (i * 2);
      const p1 = `Winner ${prefix}QF-M${String(prev1).padStart(2, '0')}`;
      const p2 = `Winner ${prefix}QF-M${String(prev2).padStart(2, '0')}`;
      const court = (i % 2 === 1) ? 'Court 1' : 'Court 2';
      const time = timesSF[idx] || '10:00 AM';

      allFixtures.push({
        matchId: `${prefix}SF-M${String(i).padStart(2, '0')}`,
        id: `${prefix}SF-M${String(i).padStart(2, '0')}`,
        category: catName,
        round: 'Semi-Final',
        day: 'Day 3',
        date: '30 Oct 2026',
        court,
        time,
        scheduledTime: time,
        pair1: p1,
        pair2: p2,
        team1Name: p1,
        team2Name: p2,
        team1P1: p1,
        team2P1: p2,
        team1Id: '',
        team2Id: '',
        nextMatchId: `${prefix}FN-M01`,
        nextMatchSlot: i,
        status: 'UPCOMING',
        winner: '',
        scores: [],
        sets: []
      });
    }

    // 1 Grand Final match (Day 3)
    const finalTime = prefix === 'B-' ? '06:00 PM' : '04:30 PM';
    allFixtures.push({
      matchId: `${prefix}FN-M01`,
      id: `${prefix}FN-M01`,
      category: catName,
      round: 'Grand Final 🏆',
      day: 'Day 3',
      date: '30 Oct 2026',
      court: 'Center Court (Court 1)',
      time: finalTime,
      scheduledTime: finalTime,
      pair1: `Winner ${prefix}SF-M01`,
      pair2: `Winner ${prefix}SF-M02`,
      team1Name: `Winner ${prefix}SF-M01`,
      team2Name: `Winner ${prefix}SF-M02`,
      team1P1: `Winner ${prefix}SF-M01`,
      team2P1: `Winner ${prefix}SF-M02`,
      team1Id: '',
      team2Id: '',
      nextMatchId: '',
      nextMatchSlot: 0,
      status: 'UPCOMING',
      winner: '',
      scores: [],
      sets: []
    });
  }

  generateCategoryFixtures('Below 35', 'B-', bRegs);
  generateCategoryFixtures('Above 35', 'A-', aRegs);

  console.log(`Generated ${allFixtures.length} total tournament fixtures.`);

  // Write all fixtures to database
  for (const f of allFixtures) {
    await query(`
      INSERT INTO matches (
        match_id, category, round, court, team1_p1, team1_p2, team2_p1, team2_p2,
        team1_name, team2_name, scheduled_time, status, winner, scores, sets, raw_payload, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, '', $6, '',
        $7, $8, $9, $10, $11, $12, $13, $14, NOW()
      )
      ON CONFLICT (match_id) DO UPDATE SET
        category = EXCLUDED.category,
        round = EXCLUDED.round,
        court = EXCLUDED.court,
        team1_p1 = EXCLUDED.team1_p1,
        team2_p1 = EXCLUDED.team2_p1,
        team1_name = EXCLUDED.team1_name,
        team2_name = EXCLUDED.team2_name,
        scheduled_time = EXCLUDED.scheduled_time,
        raw_payload = EXCLUDED.raw_payload,
        updated_at = NOW()
    `, [
      f.matchId,
      f.category,
      f.round,
      f.court,
      f.pair1,
      f.pair2,
      f.team1Name,
      f.team2Name,
      f.scheduledTime,
      f.status,
      f.winner,
      JSON.stringify(f.scores),
      JSON.stringify(f.sets),
      JSON.stringify(f)
    ]);
  }

  console.log('✅ Successfully seeded all 62 matches into Neon PostgreSQL database!');
  process.exit(0);
}

seedFullTournamentSchedule().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
