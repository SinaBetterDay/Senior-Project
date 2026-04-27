import { getMeetings, getAgendaItems, getVotes } from './legistar-api.js';

async function testLegistarAPI() {
  const baseUrl = 'https://webapi.legistar.com/v1/sacramento';

  try {
    console.log('Testing getMeetings...');
    const meetings = await getMeetings(baseUrl, 5);
    console.log(`Found ${meetings.length} upcoming meetings`);
    if (meetings.length > 0) {
      console.log('First meeting:', meetings[0]);
    }

    if (meetings.length > 0) {
      const meetingId = meetings[0].id;
      console.log(`\nTesting getAgendaItems for meeting ${meetingId}...`);
      const agendaItems = await getAgendaItems(baseUrl, meetingId);
      console.log(`Found ${agendaItems.length} agenda items`);
      if (agendaItems.length > 0) {
        console.log('First agenda item:', agendaItems[0]);

        // Test votes if there's a matter with votes
        const matterId = agendaItems[0].id;
        console.log(`\nTesting getVotes for matter ${matterId}...`);
        const votes = await getVotes(baseUrl, matterId);
        console.log(`Found ${votes.length} votes`);
        if (votes.length > 0) {
          console.log('First vote:', votes[0]);
        }
      }
    }

    console.log('\nAll tests passed!');
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testLegistarAPI();