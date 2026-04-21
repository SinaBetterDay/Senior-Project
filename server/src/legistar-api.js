/**
 * Legistar API wrapper module
 * Provides clean async functions for fetching meetings, agenda items, and votes
 */

const BASE_API_URL = 'https://webapi.legistar.com/v1';

/**
 * Sleep for a given number of milliseconds
 * @param {number} ms - milliseconds to sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make a request to the Legistar API with retry on 429
 * @param {string} url - the full URL to request
 * @param {object} options - fetch options
 * @returns {Promise<object>} - the JSON response
 */
async function apiRequest(url, options = {}) {
  const defaultOptions = {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'FAIR-Legistar-API/1.0'
    },
    timeout: 30000
  };

  const mergedOptions = { ...defaultOptions, ...options };

  try {
    const response = await fetch(url, mergedOptions);

    if (response.status === 429) {
      // Rate limited, wait 2 seconds and retry once
      await sleep(2000);
      const retryResponse = await fetch(url, mergedOptions);
      if (!retryResponse.ok) {
        throw new Error(`API request failed after retry: ${retryResponse.status} ${retryResponse.statusText}`);
      }
      return await retryResponse.json();
    }

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    if (error.message.includes('API request failed')) {
      throw error;
    }
    throw new Error(`Network error: ${error.message}`);
  }
}

/**
 * Get upcoming meetings from a Legistar jurisdiction
 * @param {string} baseUrl - the base URL for the jurisdiction (e.g., 'https://webapi.legistar.com/v1/sacramento')
 * @param {number} limit - maximum number of meetings to return
 * @returns {Promise<Array<object>>} - array of meeting objects
 */
async function getMeetings(baseUrl, limit = 50) {
  const url = new URL(`${baseUrl}/Events`);
  url.searchParams.set('$top', limit.toString());
  url.searchParams.set('$orderby', 'EventDate desc');

  // Filter for upcoming meetings (EventDate >= today)
  const today = new Date().toISOString().split('T')[0];
  url.searchParams.set('$filter', `EventDate ge datetime'${today}'`);

  const data = await apiRequest(url.toString());

  // Normalize to array of objects
  if (!Array.isArray(data)) {
    throw new Error('Unexpected response format: expected array of meetings');
  }

  return data.map(meeting => ({
    id: meeting.EventId,
    date: meeting.EventDate,
    time: meeting.EventTime,
    location: meeting.EventLocation,
    bodyName: meeting.EventBodyName,
    agendaFile: meeting.EventAgendaFile,
    minutesFile: meeting.EventMinutesFile,
    comment: meeting.EventComment,
    ...meeting // include all other fields
  }));
}

/**
 * Get agenda items for a specific meeting
 * @param {string} baseUrl - the base URL for the jurisdiction
 * @param {string|number} meetingId - the EventId of the meeting
 * @returns {Promise<Array<object>>} - array of agenda item objects
 */
async function getAgendaItems(baseUrl, meetingId) {
  const url = `${baseUrl}/Events/${meetingId}/EventItems`;

  const data = await apiRequest(url);

  // Normalize to array of objects
  if (!Array.isArray(data)) {
    throw new Error('Unexpected response format: expected array of agenda items');
  }

  return data.map(item => ({
    id: item.EventItemId,
    eventId: item.EventId,
    matterId: item.MatterId,
    matterName: item.MatterName,
    matterType: item.MatterTypeName,
    agendaNumber: item.AgendaNumber,
    agendaNote: item.AgendaNote,
    minutesNote: item.MinutesNote,
    ...item // include all other fields
  }));
}

/**
 * Get votes for a specific matter (agenda item)
 * @param {string} baseUrl - the base URL for the jurisdiction
 * @param {string|number} matterId - the EventItemId of the matter
 * @returns {Promise<Array<object>>} - array of vote objects
 */
async function getVotes(baseUrl, matterId) {
  const url = `${baseUrl}/EventItems/${matterId}/Votes`;

  const data = await apiRequest(url);

  // Normalize to array of objects
  if (!Array.isArray(data)) {
    throw new Error('Unexpected response format: expected array of votes');
  }

  return data.map(vote => ({
    id: vote.VoteId,
    eventItemId: vote.EventItemId,
    personId: vote.PersonId,
    personName: vote.PersonName,
    voteTypeId: vote.VoteTypeId,
    voteTypeName: vote.VoteTypeName,
    voteValueId: vote.VoteValueId,
    voteValueName: vote.VoteValueName,
    ...vote // include all other fields
  }));
}

module.exports = {
  getMeetings,
  getAgendaItems,
  getVotes
};