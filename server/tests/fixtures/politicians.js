import {
  scheduleBFixtures,
  scheduleCdeFixtures,
  scheduleA2Fixtures,
} from "./schedules.js";

export const politicianWithAllSchedules = {
  id: 1,
  name: "Test Politician",

  schedules: {
    scheduleB: scheduleBFixtures,
    scheduleCde: scheduleCdeFixtures,
    scheduleA2: scheduleA2Fixtures,
  },
};