const ANALYSIS_TEAMS = [
  {
    "team": 10,
    "members": [
      {
        "name": "Dan Sherman",
        "hi": 8.2,
        "l10": 3,
        "yr2": 3,
        "best": -6,
        "ly": 8,
        "form": "Declining",
        "sharp": false
      },
      {
        "name": "Josh Marlow",
        "hi": 11.0,
        "l10": 3,
        "yr2": 2,
        "best": -6,
        "ly": -1,
        "form": "Stable",
        "sharp": false
      },
      {
        "name": "Bob Donaghue",
        "hi": 16.0,
        "l10": 2,
        "yr2": 2,
        "best": -15,
        "ly": null,
        "form": "Stable",
        "sharp": false
      }
    ],
    "l10": 8,
    "yr2": 7,
    "best": -27,
    "imp": 0,
    "dec": 1,
    "sharp": 0,
    "ly": 7,
    "score": 6.5,
    "note": "Best-balanced roster: strong recent form, biggest scoring ceiling in the draft, and a proven good result at last year's event.",
    "rank": 1
  },
  {
    "team": 11,
    "members": [
      {
        "name": "Kevin Babcock",
        "hi": 6.7,
        "l10": 1,
        "yr2": 2,
        "best": -6,
        "ly": null,
        "form": "Improving",
        "sharp": false
      },
      {
        "name": "Mike Ballentine",
        "hi": 11.5,
        "l10": 3,
        "yr2": 2,
        "best": -7,
        "ly": 1,
        "form": "Improving",
        "sharp": false
      },
      {
        "name": "Wendell Carter",
        "hi": 21.1,
        "l10": 3,
        "yr2": 5,
        "best": -5,
        "ly": null,
        "form": "Improving",
        "sharp": true
      }
    ],
    "l10": 7,
    "yr2": 9,
    "best": -18,
    "imp": 3,
    "dec": 0,
    "sharp": 1,
    "ly": 1,
    "score": 7.0,
    "note": "Momentum play \u2014 all three players are improving right now, which matters in a one-day net best-ball format.",
    "rank": 2
  },
  {
    "team": 3,
    "members": [
      {
        "name": "Adam Paulson",
        "hi": 9.7,
        "l10": 2,
        "yr2": 5,
        "best": -9,
        "ly": 12,
        "form": "Improving",
        "sharp": true
      },
      {
        "name": "Aaron Graddy",
        "hi": 10.5,
        "l10": 2,
        "yr2": 3,
        "best": -4,
        "ly": 6,
        "form": "Improving",
        "sharp": false
      },
      {
        "name": "Matt Bruder",
        "hi": 15.1,
        "l10": 3,
        "yr2": 3,
        "best": -7,
        "ly": 3,
        "form": "Declining",
        "sharp": false
      }
    ],
    "l10": 7,
    "yr2": 11,
    "best": -20,
    "imp": 2,
    "dec": 1,
    "sharp": 1,
    "ly": 21,
    "score": 10.0,
    "note": "Aaron Graddy's deep 138-round history makes this team's data the most reliable; strong LY result.",
    "rank": 3
  },
  {
    "team": 9,
    "members": [
      {
        "name": "Marc Cilfone",
        "hi": 9.4,
        "l10": 3,
        "yr2": 3,
        "best": -4,
        "ly": null,
        "form": "Declining",
        "sharp": true
      },
      {
        "name": "Tim Webb",
        "hi": 13.6,
        "l10": 2,
        "yr2": 3,
        "best": -6,
        "ly": null,
        "form": "Improving",
        "sharp": false
      },
      {
        "name": "Kevin Rosenthal",
        "hi": 19.2,
        "l10": 4,
        "yr2": 2,
        "best": -9,
        "ly": 6,
        "form": "Declining",
        "sharp": false
      }
    ],
    "l10": 9,
    "yr2": 8,
    "best": -19,
    "imp": 1,
    "dec": 2,
    "sharp": 1,
    "ly": 6,
    "score": 12.5,
    "note": "Solid floor but two decliners (Cilfone, Rosenthal) drag the projection down.",
    "rank": 4
  },
  {
    "team": 7,
    "members": [
      {
        "name": "Van Huffine",
        "hi": 6.0,
        "l10": 1,
        "yr2": 4,
        "best": -5,
        "ly": 7,
        "form": "Improving",
        "sharp": false
      },
      {
        "name": "John Jordan",
        "hi": 10.9,
        "l10": 5,
        "yr2": 5,
        "best": -9,
        "ly": 4,
        "form": "Stable",
        "sharp": true
      },
      {
        "name": "Sean Granger",
        "hi": 18.0,
        "l10": 3,
        "yr2": 3,
        "best": -6,
        "ly": 10,
        "form": "Improving",
        "sharp": false
      }
    ],
    "l10": 9,
    "yr2": 12,
    "best": -20,
    "imp": 2,
    "dec": 0,
    "sharp": 1,
    "ly": 21,
    "score": 13.0,
    "note": "No decliners at all; Van Huffine (6.0 HI) is a strong anchor.",
    "rank": 5
  },
  {
    "team": 13,
    "members": [
      {
        "name": "Chris Myres",
        "hi": 6.0,
        "l10": 3,
        "yr2": 2,
        "best": -6,
        "ly": null,
        "form": "Declining",
        "sharp": false
      },
      {
        "name": "Kevin Livesay",
        "hi": 12.1,
        "l10": 3,
        "yr2": 2,
        "best": -8,
        "ly": 6,
        "form": "Declining",
        "sharp": false
      },
      {
        "name": "Dean Ricci",
        "hi": 18.1,
        "l10": 3,
        "yr2": 5,
        "best": -5,
        "ly": 5,
        "form": "Improving",
        "sharp": true
      }
    ],
    "l10": 9,
    "yr2": 9,
    "best": -19,
    "imp": 1,
    "dec": 2,
    "sharp": 1,
    "ly": 11,
    "score": 13.5,
    "note": "Chris Myres (6.0 HI) is a strong anchor, but Ricci is the only one trending up.",
    "rank": 6
  },
  {
    "team": 1,
    "members": [
      {
        "name": "John Swisher",
        "hi": 1.4,
        "l10": 4,
        "yr2": 3,
        "best": -3,
        "ly": null,
        "form": "Declining",
        "sharp": false
      },
      {
        "name": "Tim Urbaniak",
        "hi": 12.7,
        "l10": 2,
        "yr2": 5,
        "best": -5,
        "ly": null,
        "form": "Improving",
        "sharp": true
      },
      {
        "name": "Dan Margiotta",
        "hi": 18.1,
        "l10": 2,
        "yr2": 2,
        "best": -4,
        "ly": 6,
        "form": "Improving",
        "sharp": false
      }
    ],
    "l10": 8,
    "yr2": 10,
    "best": -12,
    "imp": 2,
    "dec": 1,
    "sharp": 1,
    "ly": 6,
    "score": 14.5,
    "note": "John Swisher (1.4 HI, the best player in the field) anchors this team \u2014 outcome hinges on him playing to that number.",
    "rank": 7
  },
  {
    "team": 2,
    "members": [
      {
        "name": "Bret Bologna",
        "hi": 7.2,
        "l10": 3,
        "yr2": 3,
        "best": -5,
        "ly": 10,
        "form": "Improving",
        "sharp": true
      },
      {
        "name": "Tom Frame",
        "hi": 12.2,
        "l10": 2,
        "yr2": 2,
        "best": -5,
        "ly": null,
        "form": "Improving",
        "sharp": false
      },
      {
        "name": "Tim Jipping",
        "hi": 15.8,
        "l10": 4,
        "yr2": 4,
        "best": -2,
        "ly": null,
        "form": "Declining",
        "sharp": true
      }
    ],
    "l10": 9,
    "yr2": 9,
    "best": -12,
    "imp": 2,
    "dec": 1,
    "sharp": 2,
    "ly": 10,
    "score": 14.5,
    "note": "Two SHARP players (Bologna + Jipping both near their lows) \u2014 high variance, could outperform projection.",
    "rank": 8
  },
  {
    "team": 5,
    "members": [
      {
        "name": "Rick Amodeo",
        "hi": 7.0,
        "l10": 2,
        "yr2": 2,
        "best": -5,
        "ly": -1,
        "form": "Stable",
        "sharp": false
      },
      {
        "name": "Timothy Briggs",
        "hi": 15.1,
        "l10": 4,
        "yr2": 2,
        "best": -5,
        "ly": 2,
        "form": "Declining",
        "sharp": false
      },
      {
        "name": "Jerry Lambert",
        "hi": 19.4,
        "l10": 4,
        "yr2": 2,
        "best": -7,
        "ly": -1,
        "form": "Declining",
        "sharp": false
      }
    ],
    "l10": 10,
    "yr2": 6,
    "best": -17,
    "imp": 0,
    "dec": 2,
    "sharp": 0,
    "ly": 0,
    "score": 14.5,
    "note": "Best 2yr baseline talent in the bottom half, but currently cold (0 improving, 2 declining) and no LY data.",
    "rank": 9
  },
  {
    "team": 4,
    "members": [
      {
        "name": "Marc Malczewski",
        "hi": 6.3,
        "l10": 5,
        "yr2": 2,
        "best": -6,
        "ly": 8,
        "form": "Declining",
        "sharp": false
      },
      {
        "name": "Steve O'Day",
        "hi": 9.9,
        "l10": 3,
        "yr2": 4,
        "best": -5,
        "ly": null,
        "form": "Stable",
        "sharp": false
      },
      {
        "name": "Jim Rainbolt",
        "hi": 18.5,
        "l10": 2,
        "yr2": 2,
        "best": -3,
        "ly": null,
        "form": "Declining",
        "sharp": false
      }
    ],
    "l10": 10,
    "yr2": 8,
    "best": -14,
    "imp": 0,
    "dec": 2,
    "sharp": 0,
    "ly": 8,
    "score": 18.0,
    "note": "Decent baseline talent but no momentum \u2014 zero improving players.",
    "rank": 10
  },
  {
    "team": 12,
    "members": [
      {
        "name": "Brian Thomas",
        "hi": 8.0,
        "l10": 6,
        "yr2": 4,
        "best": -5,
        "ly": null,
        "form": "Declining",
        "sharp": false
      },
      {
        "name": "Blake Donaghue",
        "hi": 14.7,
        "l10": 2,
        "yr2": 1,
        "best": -9,
        "ly": 3,
        "form": "Stable",
        "sharp": false
      },
      {
        "name": "Cihan Ozdemir",
        "hi": 22.5,
        "l10": 4,
        "yr2": 6,
        "best": -6,
        "ly": 6,
        "form": "Stable",
        "sharp": true
      }
    ],
    "l10": 12,
    "yr2": 11,
    "best": -20,
    "imp": 0,
    "dec": 1,
    "sharp": 1,
    "ly": 9,
    "score": 19.5,
    "note": "Highest combined HI in the field (45.2) \u2014 steepest hill to climb.",
    "rank": 11
  },
  {
    "team": 6,
    "members": [
      {
        "name": "Matt Ruess",
        "hi": 5.2,
        "l10": 3,
        "yr2": 4,
        "best": -5,
        "ly": 4,
        "form": "Stable",
        "sharp": false
      },
      {
        "name": "Michael Barancyk",
        "hi": 14.6,
        "l10": 4,
        "yr2": 5,
        "best": -6,
        "ly": 1,
        "form": "Stable",
        "sharp": false
      },
      {
        "name": "Ray Govert",
        "hi": 15.3,
        "l10": 3,
        "yr2": 4,
        "best": -5,
        "ly": 7,
        "form": "Declining",
        "sharp": true
      }
    ],
    "l10": 10,
    "yr2": 13,
    "best": -16,
    "imp": 0,
    "dec": 1,
    "sharp": 1,
    "ly": 12,
    "score": 20.5,
    "note": "Weakest 2yr baseline in the upper-middle tier.",
    "rank": 12
  },
  {
    "team": 8,
    "members": [
      {
        "name": "Rick Oliver Jr",
        "hi": 9.4,
        "l10": 4,
        "yr2": 6,
        "best": -3,
        "ly": null,
        "form": "Improving",
        "sharp": true
      },
      {
        "name": "Scott Yoder",
        "hi": 12.7,
        "l10": 5,
        "yr2": 4,
        "best": -14,
        "ly": -2,
        "form": "Declining",
        "sharp": false
      },
      {
        "name": "Josh Reading",
        "hi": 17.6,
        "l10": 5,
        "yr2": 6,
        "best": -4,
        "ly": null,
        "form": "Improving",
        "sharp": true
      }
    ],
    "l10": 14,
    "yr2": 16,
    "best": -21,
    "imp": 2,
    "dec": 1,
    "sharp": 2,
    "ly": -2,
    "score": 24.5,
    "note": "Only team with a positive (better-than-handicap) combined LY result \u2014 undersells current projected form, worth watching live.",
    "rank": 13
  },
  {
    "team": 14,
    "members": [
      {
        "name": "Casey Wedding",
        "hi": 9.7,
        "l10": 4,
        "yr2": 4,
        "best": -5,
        "ly": 4,
        "form": "Declining",
        "sharp": true
      },
      {
        "name": "Ruben Hernandez",
        "hi": 9.8,
        "l10": 5,
        "yr2": 6,
        "best": -3,
        "ly": 14,
        "form": "Declining",
        "sharp": true
      },
      {
        "name": "Hunter Carmichael",
        "hi": 15.2,
        "l10": 4,
        "yr2": 4,
        "best": -6,
        "ly": 4,
        "form": "Declining",
        "sharp": false
      }
    ],
    "l10": 13,
    "yr2": 14,
    "best": -14,
    "imp": 0,
    "dec": 3,
    "sharp": 2,
    "ly": 22,
    "score": 28.5,
    "note": "Every player declining on paper, but the only team with a strong (+22 combined) last-year result at this exact event \u2014 classic wildcard.",
    "rank": 14
  }
];
