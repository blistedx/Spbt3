require('dotenv').config();
const { connectDB } = require('./config/db');
const Settings = require('./models/Settings');
const Registration = require('./models/Registration');
const Match = require('./models/Match');
const { Expense, Sponsor } = require('./models/Financials');
const User = require('./models/User');

async function seedDatabase() {
  console.log('🌱 Starting Database Seeding for S.P. Badminton Tourney 3...');
  await connectDB();

  // 1. Settings & Categories
  const dataStore = require('./config/dataStore');
  const fileSettings = dataStore.getSettings();
  const existingSettings = await Settings.findOne();
  if (!existingSettings) {
    const defaultSettings = new Settings({
      tournamentName: fileSettings.tournament_name || 'S.P. BADMINTON TOURNEY 3',
      subtitle: fileSettings.tournament_subtitle || "Men's Doubles · Knockout · Suryodaya Park",
      dates: fileSettings.dates || '28–30 Aug 2026',
      venue: fileSettings.venue || 'Suryodaya Park Court',
      courtMapsUrl: 'https://maps.app.goo.gl/QnaBgoVEJa7tdQfx7',
      registrationStatus: fileSettings.registration_status || 'OPEN',
      registrationCloseDate: '27th Aug 2026, 11:59 PM',
      flashAnnouncement: fileSettings.flash_message || '🏸 Registrations are OPEN! Limited team slots available.',
      flashActive: fileSettings.flash_active === 'YES',
      upiId: fileSettings.upi_id || 'blistedx@okhdfcbank',
      upiPayeeName: fileSettings.upi_name || 'S.P. Badminton Club',
      upiQrUrl: fileSettings.upi_qr_url || 'qr_code.png',
      logoUrl: '/logo.png',
      adminPin: fileSettings.admin_pin || '9903',
      scorerPin: '123499',
      rawSettings: fileSettings,
      contactPersons: [
        { name: 'Hemant Kalra', phone: '9810332822', role: 'Tournament Director' },
        { name: 'Nitesh Sharma', phone: '9811568855', role: 'Head of Operations' }
      ],
      rules: [
        'All matches will be played in accordance with Badminton World Federation (BWF) 21-point rally scoring format.',
        'Feather shuttles will be provided for all category matches.',
        'Players must report at least 30 minutes prior to their scheduled match time.',
        'Non-marking badminton court shoes are mandatory on all synthetic courts.',
        'Referees and Tournament Committee decisions are final and binding.'
      ],
      categories: (fileSettings.categories && fileSettings.categories.length > 0) ? fileSettings.categories.map(c => ({
        code: (c.name || '').toUpperCase().replace(/\s+/g, '_'),
        name: c.name,
        type: 'Doubles',
        entryFee: Number(c.fee) || 500,
        maxAge: (c.name || '').includes('Below') ? 35 : 100,
        minAge: (c.name || '').includes('Above') ? 35 : 15,
        maxSlots: Number(c.maxPairs) || 32,
        active: c.status !== 'INACTIVE'
      })) : [
        { code: 'BELOW_35', name: "Below 35", type: 'Doubles', entryFee: 500, maxAge: 35, minAge: 15, maxSlots: 32, active: true },
        { code: 'ABOVE_35', name: "Above 35", type: 'Doubles', entryFee: 500, maxAge: 100, minAge: 35, maxSlots: 32, active: true }
      ]
    });
    await defaultSettings.save();
    console.log('✅ Tournament settings and categories seeded.');
  }

  // 2. Admin User
  const existingAdmin = await User.findOne({ username: 'admin' });
  if (!existingAdmin) {
    const adminUser = new User({
      username: 'admin',
      password: 'adminPassword123!',
      name: 'Tournament Director',
      role: 'admin',
      pin: '9903',
      email: 'admin@spbadminton.com'
    });
    await adminUser.save();
    console.log('✅ Admin user account created (username: admin, password: adminPassword123!, pin: 9903).');
  }

  // 3. Sample Registrations
  const regCount = await Registration.countDocuments();
  if (regCount === 0) {
    const sampleRegistrations = [
      {
        regId: 'SP3-2992',
        category: 'Below 35',
        categoryName: 'Below 35',
        p1Name: 'Abhishek Shukla',
        p1Phone: '9810000029',
        p1Email: 'abhishek.s@example.com',
        p1Dob: '1992-05-15',
        p1Age: '33 years',
        p1Tshirt: 'L',
        p1BloodGroup: '',
        p2Name: 'Nitesh Sharma',
        p2Phone: '9810000092',
        p2Email: 'nitesh.s@example.com',
        p2Dob: '1992-08-20',
        p2Age: '33 years',
        p2Tshirt: 'L',
        paymentAmount: 1000,
        paymentUtr: 'UPI-REF-2992',
        paymentScreenshotUrl: '',
        status: 'Pending'
      },
      {
        regId: 'SP3-2292',
        category: 'Below 35',
        categoryName: 'Below 35',
        p1Name: 'Aarav Sharma',
        p1Phone: '9810112222',
        p1Email: 'aarav.sharma@example.com',
        p1Dob: '1992-05-14',
        p1Age: '33 years',
        p1Tshirt: 'L',
        p1BloodGroup: 'O+',
        p2Name: 'Vikram Malhotra',
        p2Phone: '9810113333',
        p2Email: 'vikram.m@example.com',
        p2Dob: '1990-11-20',
        p2Age: '35 years',
        p2Tshirt: 'XL',
        paymentAmount: 1000,
        paymentUtr: 'UPI-HDFC-9928172635',
        paymentScreenshotUrl: '/qr_code.png',
        status: 'Approved'
      },
      {
        regId: 'SP3-5595',
        category: 'MEN_DOUBLES_OPEN',
        categoryName: "Men's Doubles (Open)",
        p1Name: 'Rohan Gupta',
        p1Phone: '9810555555',
        p1Email: 'rohan.gupta@example.com',
        p1Dob: '1995-08-10',
        p1Age: '30 years',
        p1Tshirt: 'M',
        p1BloodGroup: 'B+',
        p2Name: 'Karan Mehra',
        p2Phone: '9810556666',
        p2Email: 'karan.m@example.com',
        p2Dob: '1994-03-25',
        p2Age: '31 years',
        p2Tshirt: 'L',
        paymentAmount: 1000,
        paymentUtr: 'UPI-ICICI-8819203941',
        paymentScreenshotUrl: '/qr_code.png',
        status: 'Approved'
      },
      {
        regId: 'SP3-8898',
        category: 'MEN_SINGLES_OPEN',
        categoryName: "Men's Singles (Open)",
        p1Name: 'Sameer Verma',
        p1Phone: '9810888888',
        p1Email: 'sameer.v@example.com',
        p1Dob: '1998-02-17',
        p1Age: '28 years',
        p1Tshirt: 'M',
        p1BloodGroup: 'A+',
        paymentAmount: 600,
        paymentUtr: 'UPI-SBI-7728192039',
        paymentScreenshotUrl: '/qr_code.png',
        status: 'Pending'
      }
    ];

    await Registration.insertMany(sampleRegistrations);
    console.log('✅ Sample registrations seeded.');
  }

  // 4. Sample Matches / Court Fixtures
  const matchCount = await Match.countDocuments();
  if (matchCount === 0) {
    const sampleMatches = [
      {
        matchId: 'M-101',
        category: "Men's Doubles (Open)",
        round: 'Quarter Final',
        matchNumber: 1,
        courtNumber: 1,
        scheduledTime: '10:00 AM',
        team1: { name: 'Aarav & Vikram', score: 14, setsWon: 1, setScores: [21] },
        team2: { name: 'Rohan & Karan', score: 11, setsWon: 0, setScores: [17] },
        currentSet: 1,
        server: 'team1',
        status: 'Scheduled',
        isLive: false
      },
      {
        matchId: 'M-102',
        category: "Men's Singles (Open)",
        round: 'Quarter Final',
        matchNumber: 2,
        courtNumber: 2,
        scheduledTime: '10:45 AM',
        team1: { name: 'Sameer Verma', score: 0, setsWon: 0, setScores: [] },
        team2: { name: 'Kabir Singhania', score: 0, setsWon: 0, setScores: [] },
        currentSet: 1,
        server: 'team1',
        status: 'Scheduled',
        isLive: false
      }
    ];

    await Match.insertMany(sampleMatches);
    console.log('✅ Sample live matches and fixtures seeded.');
  }

  // 5. Sample Financials
  const expCount = await Expense.countDocuments();
  if (expCount === 0) {
    await Expense.insertMany([
      { expenseId: 'EXP-01', title: 'Yonex Aerosensa 30 Feather Shuttles (10 Tubes)', category: 'Shuttles', amount: 18500, paidTo: 'Yonex Pro Shop', paidBy: 'Hemant Kalra' },
      { expenseId: 'EXP-02', title: 'Championship Trophies & Custom Medals', category: 'Trophies & Medals', amount: 14000, paidTo: 'Apex Awards', paidBy: 'Hemant Kalra' },
      { expenseId: 'EXP-03', title: 'Tournament Arena Synthetic Court Booking', category: 'Court Rental', amount: 25000, paidTo: 'SP Sports Complex', paidBy: 'Hemant Kalra' }
    ]);
    console.log('✅ Sample expenses seeded.');
  }

  const sponCount = await Sponsor.countDocuments();
  if (sponCount === 0) {
    await Sponsor.insertMany([
      { sponsorId: 'SPON-01', name: 'Yonex India', company: 'Sunrise Sports', tier: 'Title Sponsor', amount: 50000, website: 'https://yonex.com', status: 'Received' },
      { sponsorId: 'SPON-02', name: 'Gatorade Sports Drink', company: 'PepsiCo', tier: 'Beverage Partner', amount: 20000, website: 'https://gatorade.com', status: 'Received' }
    ]);
    console.log('✅ Sample sponsors seeded.');
  }

  console.log('🎉 Seeding completed successfully!');
}

if (require.main === module) {
  seedDatabase().then(() => {
    process.exit(0);
  }).catch(err => {
    console.error('Seeding error:', err);
    process.exit(1);
  });
}

module.exports = { seedDatabase };
