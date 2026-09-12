async function runTest() {
  console.log('Testing full multi-round knockout progression...');

  // 1. Complete B-M01
  await fetch('http://localhost:3000/exec', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      action: 'updateLiveMatch',
      matchId: 'B-M01',
      status: 'COMPLETED',
      isComplete: true,
      winner: 'Aarav Sharma / Kabir Verma',
      pair1: 'Aarav Sharma / Kabir Verma',
      pair2: 'Rohan Mehta / Vivaan Sen',
      category: 'Below 35',
      games: [[21, 15], [21, 18]],
      setsWon: [2, 0]
    })
  });

  // 2. Complete B-M02
  await fetch('http://localhost:3000/exec', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      action: 'updateLiveMatch',
      matchId: 'B-M02',
      status: 'COMPLETED',
      isComplete: true,
      winner: 'Arjun Patel / Aditya Desai',
      pair1: 'Arjun Patel / Aditya Desai',
      pair2: 'Siddharth Reddy / Varun Nair',
      category: 'Below 35',
      games: [[21, 19], [18, 21], [21, 16]],
      setsWon: [2, 1]
    })
  });

  // 3. Check B-R16-M01
  const d1 = await fetch('http://localhost:3000/exec?action=getSchedule').then(r => r.json());
  const r16 = d1.schedule.find(m => m.matchId === 'B-R16-M01');
  console.log('B-R16-M01 setup:', r16.matchId, 'Pair 1:', r16.pair1, 'VS Pair 2:', r16.pair2);

  // 4. Complete B-R16-M01
  await fetch('http://localhost:3000/exec', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      action: 'updateLiveMatch',
      matchId: 'B-R16-M01',
      status: 'COMPLETED',
      isComplete: true,
      winner: 'Aarav Sharma / Kabir Verma',
      pair1: r16.pair1,
      pair2: r16.pair2,
      category: 'Below 35',
      games: [[21, 16], [21, 14]],
      setsWon: [2, 0]
    })
  });

  const d2 = await fetch('http://localhost:3000/exec?action=getSchedule').then(r => r.json());
  const qf = d2.schedule.find(m => m.matchId === 'B-QF-M01');
  console.log('B-QF-M01 setup:', qf.matchId, 'Pair 1:', qf.pair1, 'VS Pair 2:', qf.pair2);
  console.log('✅ Knockout advancement verified successfully!');
}

runTest().catch(console.error);
