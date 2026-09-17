//Schedule B => real estate
//Schedule C => income
//Schedule D => gifts
//Schedule E => travel
//Schedule A2 => business positions

export const scheduleBFixtures = [
  {
    politicianId: 1,
    propertyDescription: "123 Main Street",
    city: "Sacramento",
    county: "Sacramento",
  },
];

export const scheduleCdeFixtures = [
  {
    politicianId: 1,
    sourceName: "Acme Corporation",
    amount: 5000,
    scheduleType: "C",
  },
  {
    politicianId: 1,
    sourceName: "Downtown Business Association",
    amount: 100,
    scheduleType: "D",
  },
  {
    politicianId: 1,
    sourceName: "Regional Planning Council",
    amount: 250,
    scheduleType: "E",
  },
];

export const scheduleA2Fixtures = [
  {
    politicianId: 1,
    entityName: "Acme Corporation",
    businessPosition: "Board Member",
  },
];