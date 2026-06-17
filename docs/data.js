const PLAYERS = [
  {
    "name": "John Swisher",
    "flight": "A",
    "hcp": 1.4,
    "courseHcp": 1,
    "avgDiff": 1.4,
    "trend": "stable",
    "overMax": false
  },
  {
    "name": "Matt Ruess",
    "flight": "A",
    "hcp": 5.2,
    "courseHcp": 5,
    "avgDiff": 7.97,
    "trend": "improving",
    "overMax": false
  },
  {
    "name": "Chris Myers",
    "flight": "A",
    "hcp": 6.0,
    "courseHcp": 6,
    "avgDiff": 8.21,
    "trend": "stable",
    "overMax": false
  },
  {
    "name": "Van Huffine",
    "flight": "A",
    "hcp": 6.2,
    "courseHcp": 6,
    "avgDiff": 6.2,
    "trend": "stable",
    "overMax": false
  },
  {
    "name": "Marcus Malczewski",
    "flight": "A",
    "hcp": 6.3,
    "courseHcp": 6,
    "avgDiff": 10.48,
    "trend": "declining",
    "overMax": false
  },
  {
    "name": "Kevin Babcock",
    "flight": "A",
    "hcp": 6.7,
    "courseHcp": 7,
    "avgDiff": 9.15,
    "trend": "improving",
    "overMax": false
  },
  {
    "name": "Richard Amodeo",
    "flight": "A",
    "hcp": 7.0,
    "courseHcp": 7,
    "avgDiff": 9.11,
    "trend": "stable",
    "overMax": false
  },
  {
    "name": "Bret Bologna",
    "flight": "A",
    "hcp": 7.2,
    "courseHcp": 7,
    "avgDiff": 9.45,
    "trend": "stable",
    "overMax": false
  },
  {
    "name": "Dan Sherman",
    "flight": "A",
    "hcp": 8.2,
    "courseHcp": 9,
    "avgDiff": 10.73,
    "trend": "declining",
    "overMax": false
  },
  {
    "name": "Richard Oliver Jr",
    "flight": "A",
    "hcp": 9.4,
    "courseHcp": 10,
    "avgDiff": 10.6,
    "trend": "declining",
    "overMax": false
  },
  {
    "name": "Casey Wedding",
    "flight": "B",
    "hcp": 9.7,
    "courseHcp": 10,
    "avgDiff": 11.27,
    "trend": "declining",
    "overMax": false
  },
  {
    "name": "Adam Paulson",
    "flight": "B",
    "hcp": 9.7,
    "courseHcp": 10,
    "avgDiff": 12.94,
    "trend": "improving",
    "overMax": false
  },
  {
    "name": "Eric Newell",
    "flight": "B",
    "hcp": 10.2,
    "courseHcp": 11,
    "avgDiff": 15.07,
    "trend": "stable",
    "overMax": false
  },
  {
    "name": "John Jordan",
    "flight": "B",
    "hcp": 10.9,
    "courseHcp": 12,
    "avgDiff": 13.81,
    "trend": "declining",
    "overMax": false
  },
  {
    "name": "Josh Marlow",
    "flight": "B",
    "hcp": 11.0,
    "courseHcp": 12,
    "avgDiff": 13.5,
    "trend": "stable",
    "overMax": false
  },
  {
    "name": "Mike Ballentine",
    "flight": "B",
    "hcp": 11.5,
    "courseHcp": 12,
    "avgDiff": 14.33,
    "trend": "stable",
    "overMax": false
  },
  {
    "name": "Daniel Darlson",
    "flight": "B",
    "hcp": 12.1,
    "courseHcp": 13,
    "avgDiff": 15.01,
    "trend": "improving",
    "overMax": false
  },
  {
    "name": "Kevin Livesay",
    "flight": "B",
    "hcp": 12.1,
    "courseHcp": 13,
    "avgDiff": 12.28,
    "trend": "improving",
    "overMax": false
  },
  {
    "name": "Tom Frame",
    "flight": "B",
    "hcp": 12.2,
    "courseHcp": 13,
    "avgDiff": 14.92,
    "trend": "stable",
    "overMax": false
  },
  {
    "name": "Tim Urbaniak",
    "flight": "B",
    "hcp": 12.7,
    "courseHcp": 14,
    "avgDiff": 12.7,
    "trend": "stable",
    "overMax": false
  },
  {
    "name": "Michael Barancyk",
    "flight": "B",
    "hcp": 14.6,
    "courseHcp": 16,
    "avgDiff": 17.58,
    "trend": "stable",
    "overMax": false
  },
  {
    "name": "Matt Bruder",
    "flight": "C",
    "hcp": 15.1,
    "courseHcp": 16,
    "avgDiff": 18.03,
    "trend": "stable",
    "overMax": false
  },
  {
    "name": "Hunter Carmichael",
    "flight": "C",
    "hcp": 15.2,
    "courseHcp": 16,
    "avgDiff": 18.8,
    "trend": "declining",
    "overMax": false
  },
  {
    "name": "Ray Govert",
    "flight": "C",
    "hcp": 15.3,
    "courseHcp": 17,
    "avgDiff": 17.24,
    "trend": "stable",
    "overMax": false
  },
  {
    "name": "Josh Reading",
    "flight": "C",
    "hcp": 17.6,
    "courseHcp": 19,
    "avgDiff": 22.22,
    "trend": "stable",
    "overMax": false
  },
  {
    "name": "Sean Granger",
    "flight": "C",
    "hcp": 18.0,
    "courseHcp": 20,
    "avgDiff": 20.67,
    "trend": "declining",
    "overMax": false
  },
  {
    "name": "Dean Ricci",
    "flight": "C",
    "hcp": 18.1,
    "courseHcp": 20,
    "avgDiff": 21.86,
    "trend": "improving",
    "overMax": false
  },
  {
    "name": "Kevin Rosenthal",
    "flight": "C",
    "hcp": 19.2,
    "courseHcp": 21,
    "avgDiff": 20.55,
    "trend": "stable",
    "overMax": false
  },
  {
    "name": "Jerry Lambert",
    "flight": "C",
    "hcp": 19.4,
    "courseHcp": 21,
    "avgDiff": 23.22,
    "trend": "stable",
    "overMax": false
  },
  {
    "name": "Wendell Carter",
    "flight": "C",
    "hcp": 21.1,
    "courseHcp": 23,
    "avgDiff": 23.29,
    "trend": "improving",
    "overMax": false
  },
  {
    "name": "Cihan Ozdemir",
    "flight": "C",
    "hcp": 22.5,
    "courseHcp": 25,
    "avgDiff": 28.02,
    "trend": "improving",
    "overMax": true
  }
];
