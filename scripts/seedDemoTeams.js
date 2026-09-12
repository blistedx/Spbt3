require('dotenv').config();
const { query } = require('../config/postgres');
const dataStore = require('../config/dataStore');

const below35Names = [
  ["Aarav Sharma", "Kabir Verma"],
  ["Rohan Mehta", "Vivaan Sen"],
  ["Arjun Patel", "Aditya Desai"],
  ["Siddharth Reddy", "Varun Nair"],
  ["Ishan Chopra", "Dev Joshi"],
  ["Reyansh Singh", "Aayush Gill"],
  ["Dhruv Yadav", "Manan Kumar"],
  ["Ananya Gupta", "Krrish Rao"],
  ["Pranav Kulkarni", "Harsh Shinde"],
  ["Sahil Bhatia", "Nikhil Kapoor"],
  ["Yash Vardhan", "Tanmay Saxena"],
  ["Ritvik Nambiar", "Tejas Pillai"],
  ["Ayush Trivedi", "Samar Pandey"],
  ["Utkarsh Mishra", "Shreyas Tiwari"],
  ["Raghav Goel", "Kunal Aggarwal"],
  ["Bhavya Bansal", "Parth Mittal"],
  ["Aryan Chawla", "Armaan Grover"],
  ["Gaurav Kashyap", "Deepak Rawat"],
  ["Mayank Singhania", "Jayesh Dhoot"],
  ["Chirag Suri", "Tarun Lamba"],
  ["Kartik Hegde", "Chinmay Kamath"],
  ["Divyansh Chauhan", "Alok Tomar"],
  ["Neil Mukherjee", "Subhashish Ghosh"],
  ["Saurabh Ganguly", "Debabrata Bose"],
  ["Hitesh Solanki", "Bhavesh Parmar"],
  ["Jatin Ahuja", "Karan Wadhwa"],
  ["Mohit Kalra", "Nitesh Shukla"],
  ["Keshav Das", "Madhav Menon"],
  ["Vedant Kaushik", "Aniket Bharadwaj"],
  ["Tushar Sethi", "Rishabh Narang"],
  ["Omkar Gaikwad", "Suyash Jadhav"],
  ["Lakshay Sen", "Priyanshu Rajawat"]
];

const above35Names = [
  ["Rajesh Sharma", "Sunil Verma"],
  ["Anil Gupta", "Sanjeev Rao"],
  ["Hemant Kalra", "Nitesh Sharma"],
  ["Sanjay Mehta", "Pradeep Sen"],
  ["Alok Patel", "Manoj Desai"],
  ["Ramesh Reddy", "Sudhir Nair"],
  ["Vikas Chopra", "Ashish Joshi"],
  ["Harish Singh", "Balwinder Gill"],
  ["Deepak Yadav", "Surendra Kumar"],
  ["Arvind Kulkarni", "Milind Shinde"],
  ["Pankaj Bhatia", "Rakesh Kapoor"],
  ["Satish Saxena", "Girish Mathur"],
  ["Venkat Iyer", "Narayanan Pillai"],
  ["Dinesh Trivedi", "Brijesh Pandey"],
  ["Mahesh Mishra", "Akhilesh Tiwari"],
  ["Vijay Goel", "Pramod Aggarwal"],
  ["Anand Bansal", "Naresh Mittal"],
  ["Kamal Chawla", "Sanjay Grover"],
  ["Rajiv Kashyap", "Kuldeep Rawat"],
  ["Vivek Singhania", "Lalit Dhoot"],
  ["Arun Suri", "Jagdish Lamba"],
  ["Suresh Hegde", "Prabhakar Kamath"],
  ["Bhupendra Chauhan", "Rajendra Tomar"],
  ["Sourav Mukherjee", "Amitava Ghosh"],
  ["Bikramjit Bose", "Subir Roy"],
  ["Jayantilal Solanki", "Pravin Parmar"],
  ["Vinod Ahuja", "Ashok Wadhwa"],
  ["Jitendra Shukla", "Shailendra Shukla"],
  ["Narottam Das", "Gopinath Menon"],
  ["Sridhar Kaushik", "Ramanathan Bharadwaj"],
  ["Praveen Sethi", "Ravinder Narang"],
  ["Chandrakant Gaikwad", "Dilip Jadhav"]
];

const tshirts = ['M', 'L', 'XL', 'S', 'XXL'];

async function seedTeams() {
  console.log('🏸 Seeding 32 teams for Below 35 and 32 teams for Above 35...');

  // Clean previous demo registrations if any
  await query("DELETE FROM registrations WHERE reg_id LIKE 'SP3-B35-%' OR reg_id LIKE 'SP3-A35-%'");

  const now = new Date();

  // 1. Seed Below 35
  for (let i = 0; i < below35Names.length; i++) {
    const num = String(i + 1).padStart(2, '0');
    const regId = `SP3-B35-${num}`;
    const [p1Name, p2Name] = below35Names[i];
    const p1Phone = `99900100${num}`;
    const p2Phone = `99900200${num}`;
    const p1Email = `b35.p1.${num}@spbadminton.demo`;
    const p2Email = `b35.p2.${num}@spbadminton.demo`;
    const birthYear1 = 1994 + (i % 8); // 1994 to 2001 (ages 25-32)
    const birthYear2 = 1995 + (i % 7);
    const p1Dob = `${birthYear1}-0${(i % 9) + 1}-15`;
    const p2Dob = `${birthYear2}-0${((i + 3) % 9) + 1}-20`;
    const p1Tshirt = tshirts[i % tshirts.length];
    const p2Tshirt = tshirts[(i + 1) % tshirts.length];
    const utr = `UPI-B35-DEMO${num}`;

    const rawPayload = {
      regId,
      category: 'Below 35',
      categoryName: 'Below 35',
      p1Name,
      player1Name: p1Name,
      p1Phone,
      player1Phone: p1Phone,
      p1Email,
      player1Email: p1Email,
      p1Dob,
      player1Dob: p1Dob,
      p1Age: `${2026 - birthYear1} years`,
      player1Age: `${2026 - birthYear1} years`,
      p1Tshirt,
      player1Tshirt: p1Tshirt,
      p2Name,
      player2Name: p2Name,
      p2Phone,
      player2Phone: p2Phone,
      p2Email,
      player2Email: p2Email,
      p2Dob,
      player2Dob: p2Dob,
      p2Age: `${2026 - birthYear2} years`,
      player2Age: `${2026 - birthYear2} years`,
      p2Tshirt,
      player2Tshirt: p2Tshirt,
      upiUtr: utr,
      paymentUtr: utr,
      paymentAmount: 1000,
      fee: 1000,
      paymentStatus: 'VERIFIED',
      status: 'APPROVED',
      adminNotes: 'Demo team verified & ready for tournament fixtures',
      timestamp: new Date(now.getTime() - (64 - i) * 3600000).toISOString()
    };

    await query(`
      INSERT INTO registrations (
        reg_id, category, p1_name, p1_phone, p1_email, p1_dob, p1_tshirt, p1_id_type, p1_id_number,
        p2_name, p2_phone, p2_email, p2_dob, p2_tshirt, p2_id_type, p2_id_number,
        upi_utr, payment_screenshot_url, payment_status, status, admin_notes, raw_payload, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24
      )
      ON CONFLICT (reg_id) DO UPDATE SET
        category = EXCLUDED.category,
        p1_name = EXCLUDED.p1_name,
        p1_phone = EXCLUDED.p1_phone,
        p1_email = EXCLUDED.p1_email,
        p2_name = EXCLUDED.p2_name,
        p2_phone = EXCLUDED.p2_phone,
        p2_email = EXCLUDED.p2_email,
        status = EXCLUDED.status,
        payment_status = EXCLUDED.payment_status,
        raw_payload = EXCLUDED.raw_payload,
        updated_at = NOW()
    `, [
      regId, 'Below 35', p1Name, p1Phone, p1Email, p1Dob, p1Tshirt, 'Aadhaar', `XXXX-XXXX-10${num}`,
      p2Name, p2Phone, p2Email, p2Dob, p2Tshirt, 'Aadhaar', `XXXX-XXXX-20${num}`,
      utr, '/qr_code.png', 'VERIFIED', 'APPROVED', 'Demo team verified & ready for tournament fixtures',
      JSON.stringify(rawPayload),
      new Date(now.getTime() - (64 - i) * 3600000),
      new Date(now.getTime() - (64 - i) * 3600000)
    ]);
  }
  console.log('✅ 32 teams seeded for Below 35.');

  // 2. Seed Above 35
  for (let i = 0; i < above35Names.length; i++) {
    const num = String(i + 1).padStart(2, '0');
    const regId = `SP3-A35-${num}`;
    const [p1Name, p2Name] = above35Names[i];
    const p1Phone = `98800100${num}`;
    const p2Phone = `98800200${num}`;
    const p1Email = `a35.p1.${num}@spbadminton.demo`;
    const p2Email = `a35.p2.${num}@spbadminton.demo`;
    const birthYear1 = 1975 + (i % 12); // 1975 to 1987 (ages 39-51)
    const birthYear2 = 1976 + (i % 11);
    const p1Dob = `${birthYear1}-0${(i % 9) + 1}-10`;
    const p2Dob = `${birthYear2}-0${((i + 2) % 9) + 1}-18`;
    const p1Tshirt = tshirts[i % tshirts.length];
    const p2Tshirt = tshirts[(i + 2) % tshirts.length];
    const utr = `UPI-A35-DEMO${num}`;

    const rawPayload = {
      regId,
      category: 'Above 35',
      categoryName: 'Above 35',
      p1Name,
      player1Name: p1Name,
      p1Phone,
      player1Phone: p1Phone,
      p1Email,
      player1Email: p1Email,
      p1Dob,
      player1Dob: p1Dob,
      p1Age: `${2026 - birthYear1} years`,
      player1Age: `${2026 - birthYear1} years`,
      p1Tshirt,
      player1Tshirt: p1Tshirt,
      p2Name,
      player2Name: p2Name,
      p2Phone,
      player2Phone: p2Phone,
      p2Email,
      player2Email: p2Email,
      p2Dob,
      player2Dob: p2Dob,
      p2Age: `${2026 - birthYear2} years`,
      player2Age: `${2026 - birthYear2} years`,
      p2Tshirt,
      player2Tshirt: p2Tshirt,
      upiUtr: utr,
      paymentUtr: utr,
      paymentAmount: 1000,
      fee: 1000,
      paymentStatus: 'VERIFIED',
      status: 'APPROVED',
      adminNotes: 'Demo team verified & ready for tournament fixtures',
      timestamp: new Date(now.getTime() - (32 - i) * 3600000).toISOString()
    };

    await query(`
      INSERT INTO registrations (
        reg_id, category, p1_name, p1_phone, p1_email, p1_dob, p1_tshirt, p1_id_type, p1_id_number,
        p2_name, p2_phone, p2_email, p2_dob, p2_tshirt, p2_id_type, p2_id_number,
        upi_utr, payment_screenshot_url, payment_status, status, admin_notes, raw_payload, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24
      )
      ON CONFLICT (reg_id) DO UPDATE SET
        category = EXCLUDED.category,
        p1_name = EXCLUDED.p1_name,
        p1_phone = EXCLUDED.p1_phone,
        p1_email = EXCLUDED.p1_email,
        p2_name = EXCLUDED.p2_name,
        p2_phone = EXCLUDED.p2_phone,
        p2_email = EXCLUDED.p2_email,
        status = EXCLUDED.status,
        payment_status = EXCLUDED.payment_status,
        raw_payload = EXCLUDED.raw_payload,
        updated_at = NOW()
    `, [
      regId, 'Above 35', p1Name, p1Phone, p1Email, p1Dob, p1Tshirt, 'Aadhaar', `XXXX-XXXX-30${num}`,
      p2Name, p2Phone, p2Email, p2Dob, p2Tshirt, 'Aadhaar', `XXXX-XXXX-40${num}`,
      utr, '/qr_code.png', 'VERIFIED', 'APPROVED', 'Demo team verified & ready for tournament fixtures',
      JSON.stringify(rawPayload),
      new Date(now.getTime() - (32 - i) * 3600000),
      new Date(now.getTime() - (32 - i) * 3600000)
    ]);
  }
  console.log('✅ 32 teams seeded for Above 35.');

  // Also seed initial scheduled matches (e.g. Round of 32 opening fixtures)
  console.log('🏸 Creating sample scheduled matches for Day 1 fixtures...');
  const sampleMatches = [
    // Below 35 - Round of 32 Opening Matches
    {
      matchId: 'M-B35-01',
      category: 'Below 35',
      round: 'Round of 32',
      court: 'Court 1 (Main Court)',
      time: '28 Aug 2026, 04:30 PM',
      scheduled_time: '2026-08-28T16:30',
      team1_name: `${below35Names[0][0]} / ${below35Names[0][1]}`,
      team2_name: `${below35Names[1][0]} / ${below35Names[1][1]}`,
      team1_p1: below35Names[0][0],
      team1_p2: below35Names[0][1],
      team2_p1: below35Names[1][0],
      team2_p2: below35Names[1][1],
      status: 'SCHEDULED'
    },
    {
      matchId: 'M-B35-02',
      category: 'Below 35',
      round: 'Round of 32',
      court: 'Court 2',
      time: '28 Aug 2026, 05:15 PM',
      scheduled_time: '2026-08-28T17:15',
      team1_name: `${below35Names[2][0]} / ${below35Names[2][1]}`,
      team2_name: `${below35Names[3][0]} / ${below35Names[3][1]}`,
      team1_p1: below35Names[2][0],
      team1_p2: below35Names[2][1],
      team2_p1: below35Names[3][0],
      team2_p2: below35Names[3][1],
      status: 'SCHEDULED'
    },
    // Above 35 - Round of 32 Opening Matches
    {
      matchId: 'M-A35-01',
      category: 'Above 35',
      round: 'Round of 32',
      court: 'Court 1 (Main Court)',
      time: '28 Aug 2026, 06:00 PM',
      scheduled_time: '2026-08-28T18:00',
      team1_name: `${above35Names[0][0]} / ${above35Names[0][1]}`,
      team2_name: `${above35Names[1][0]} / ${above35Names[1][1]}`,
      team1_p1: above35Names[0][0],
      team1_p2: above35Names[0][1],
      team2_p1: above35Names[1][0],
      team2_p2: above35Names[1][1],
      status: 'SCHEDULED'
    },
    {
      matchId: 'M-A35-02',
      category: 'Above 35',
      round: 'Round of 32',
      court: 'Court 2',
      time: '28 Aug 2026, 06:45 PM',
      scheduled_time: '2026-08-28T18:45',
      team1_name: `${above35Names[2][0]} / ${above35Names[2][1]}`,
      team2_name: `${above35Names[3][0]} / ${above35Names[3][1]}`,
      team1_p1: above35Names[2][0],
      team1_p2: above35Names[2][1],
      team2_p1: above35Names[3][0],
      team2_p2: above35Names[3][1],
      status: 'SCHEDULED'
    }
  ];

  for (const m of sampleMatches) {
    await query(`
      INSERT INTO matches (match_id, category, round, court, team1_name, team2_name, team1_p1, team1_p2, team2_p1, team2_p2, scheduled_time, status, raw_payload)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (match_id) DO UPDATE SET
        category = EXCLUDED.category,
        round = EXCLUDED.round,
        court = EXCLUDED.court,
        team1_name = EXCLUDED.team1_name,
        team2_name = EXCLUDED.team2_name,
        scheduled_time = EXCLUDED.scheduled_time,
        status = EXCLUDED.status,
        updated_at = NOW()
    `, [
      m.matchId, m.category, m.round, m.court, m.team1_name, m.team2_name,
      m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2, m.time, m.status,
      JSON.stringify(m)
    ]);
  }
  console.log('✅ Sample scheduled matches created.');

  // Refresh dataStore hot cache
  await dataStore.syncFromDb();
  console.log('🎉 All 64 teams & sample matches successfully synced into Neon Database & Memory Cache!');
  process.exit(0);
}

seedTeams().catch(err => {
  console.error('❌ Error seeding teams:', err);
  process.exit(1);
});
