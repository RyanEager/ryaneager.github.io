/*jshint esversion: 6 */ 

var game = {
    gamePk: new URLSearchParams(window.location.search).get('gamePk'),
    runcount: 0,
    graph: function(callback) {

        var request = new XMLHttpRequest();
        request.open('GET', `https://statsapi.web.nhl.com/api/v1/game/${this.gamePk}/feed/live`, true);

        request.onload = () => {
            var data = JSON.parse(request.response);

            this.game_date = new Date(data.gameData.datetime.dateTime);
            this.away_triCode = data.gameData.teams.away.triCode;
            this.home_triCode = data.gameData.teams.home.triCode;
            this.away_teamName = data.gameData.teams.away.teamName;
            this.home_teamName = data.gameData.teams.home.teamName;

            this.shots = {};
            this.penalities = {};

            this.shots[this.away_triCode] = {'desc': [''], 'shots': [convert_time(this.game_date, '00:00')], 'goals': []};
            this.shots[this.home_triCode] = {'desc': [''], 'shots': [convert_time(this.game_date, '00:00')], 'goals': []};

            this.penalities[this.away_triCode] = [];
            this.penalities[this.home_triCode] = [];

            this.home_color = colors[this.home_triCode].mainColor.hex;
            this.away_color = colors[this.away_triCode].mainColor.hex;

            this.current_period = data.liveData.linescore.currentPeriod;

            var all_plays = data.liveData.plays.allPlays;

            all_plays.forEach(play => {
                var triCode;
                var period_time;
                var period;
                if(play.result.eventTypeId == 'SHOT' || play.result.eventTypeId == 'GOAL'){
                    triCode = play.team.triCode;
                    period_time = play.about.periodTime;
                    period = play.about.period;
                    var desc = play.result.description;
                    this.shots[triCode].shots.push(convert_time(this.game_date, period_time, period));
                    this.shots[triCode].desc.push(desc + ' @ ' + period_time);

                    if(play.result.eventTypeId == 'GOAL'){
                        var scorer = '';
                        play.players.forEach(player => {
                            if(player.playerType == 'Scorer'){
                                var player_name = player.player.fullName;
                                scorer = player_name.substr(player_name.indexOf(" ") + 1);
                            }
                        });

                        if(play.result.emptyNet){
                            scorer += ' [EN]';
                        }

                        if(play.result.strength.code == 'SHG'){
                            scorer += ' [SH]';
                        }

                        this.shots[triCode].goals.push({
                            'x': convert_time(this.game_date, period_time, period),
                            'y': this.shots[triCode].shots.length - 1,
                            'desc': scorer
                        });

                        // if PPG end the PP graph at current time
                        // TODO: add logic to make sure last pen is of right team
                        if(play.result.strength.code == 'PPG'){
                            var last_pen;
                            if(triCode == this.home_triCode){
                                last_pen = this.penalities[this.away_triCode].pop();
                                this.penalities[this.away_triCode].push([last_pen[0], convert_time(this.game_date, period_time, period), last_pen[2]]);
                            } else {
                                last_pen = this.penalities[this.home_triCode].pop();
                                this.penalities[this.home_triCode].push([last_pen[0], convert_time(this.game_date, period_time, period), last_pen[2]]);
                            }
                        }
                    }
                } else if(play.result.eventTypeId == 'PENALTY'){
                    triCode = play.team.triCode;
                    period_time = play.about.periodTime;
                    period = play.about.period;

                    var pen_length = play.result.penaltyMinutes;
                    var pen_type = play.result.secondaryType;

                    if(pen_length > 0 && pen_type != 'Fighting' && pen_type != 'Misconduct'){
                        var pen_start = convert_time(this.game_date, period_time, period);
                        var pen_end = new Date(pen_start.getTime() + pen_length * 60000);
                        var pen_desc = play.result.description + ' @ ' + period_time;
                        this.penalities[triCode].push([pen_start, pen_end, pen_desc]);
                    }
                }
            });

            var away_shot_count = this.shots[this.away_triCode].shots.length - 1;
            var home_shot_count = this.shots[this.home_triCode].shots.length - 1;
            var away_goal_count = this.shots[this.away_triCode].goals.length;
            var home_goal_count = this.shots[this.home_triCode].goals.length;
            this.max_shots = Math.max(home_shot_count, away_shot_count);

            this.graph_data = [];

            // Away Shots
            this.graph_data.push({
                name: `${this.away_triCode} | G:${away_goal_count} S:${away_shot_count}`,
                hoverinfo: 'text',
                text: this.shots[this.away_triCode].desc,
                mode: 'lines',
                line: {
                    'color': this.away_color,
                    'width': 2
                },
                x: this.shots[this.away_triCode].shots,
                y: [...Array(away_shot_count + 1).keys()]
            });

            // Home Shots
            this.graph_data.push({
                name: `${this.home_triCode} | G:${home_goal_count} S:${home_shot_count} `,
                hoverinfo: 'text',
                text: this.shots[this.home_triCode].desc,
                mode: 'lines',
                line: {
                    'color': this.home_color,
                    'width': 2
                },
                x: this.shots[this.home_triCode].shots,
                y: [...Array(home_shot_count + 1).keys()]
            });

            // Away Penalties
            this.penalities[this.away_triCode].forEach(penality =>{
                this.graph_data.push({
                    name: this.home_triCode + ' Power Play',
                    hoverinfo: 'text',
                    showlegend: false,
                    text: [penality[2]],
                    x: penality,
                    y: [this.max_shots, this.max_shots],
                    fill: 'tozeroy',
                    mode: 'lines',
                    line: {
                        'color': this.home_color,
                        'width': 0
                    }
                });
            });

            // Home Penalties
            this.penalities[this.home_triCode].forEach(penality =>{
                this.graph_data.push({
                    name: this.away_triCode + ' Power Play',
                    hoverinfo: 'text',
                    showlegend: false,
                    text: [penality[2]],
                    x: penality,
                    y: [this.max_shots, this.max_shots],
                    fill: 'tozeroy',
                    mode: 'lines',
                    line: {
                        'color': this.away_color,
                        'width': 0
                    }
                });
            });

            var set_goal_anno_placement = ((otherteam_tricode, axis, current_x, our_shot_count) => {
                var their_shot_count = 0;
                var location = {
                    above: {
                        x: -40,
                        y: -20,
                    },
                    below: {
                        x: 40,
                        y: 20
                    }
                };

                this.shots[otherteam_tricode].shots.forEach(shot => {
                    if(current_x > shot) their_shot_count++;
                });

                return (their_shot_count > our_shot_count) ? location.below[axis] : location.above[axis];
         
            });

            this.annotations = [];

            // Away Goal Annotation
            this.shots[this.away_triCode].goals.forEach(goal => {
                this.annotations.push({
                    x: goal.x,
                    y: goal.y,
                    xref: 'x',
                    yref: 'y',
                    text: goal.desc,
                    showarrow: true,
                    arrowhead: 7,
                    ax: set_goal_anno_placement(this.home_triCode, 'x', goal.x, goal.y),
                    ay: set_goal_anno_placement(this.home_triCode, 'y', goal.x, goal.y)
                });
            });

            // Home Goal Annotation
            this.shots[this.home_triCode].goals.forEach(goal => {
                this.annotations.push({
                    x: goal.x,
                    y: goal.y,
                    xref: 'x',
                    yref: 'y',
                    text: goal.desc,
                    showarrow: true,
                    arrowhead: 7,
                    ax: set_goal_anno_placement(this.away_triCode, 'x', goal.x, goal.y),
                    ay: set_goal_anno_placement(this.away_triCode, 'y', goal.x, goal.y)
                });
            });

            var layout = {
                title: `${this.away_teamName} at ${this.home_teamName} | Shots, Goals, & PP`,
                xaxis: {
                    'tickvals': [
                        convert_time(this.game_date,'00:00'),
                        convert_time(this.game_date,'05:00'), convert_time(this.game_date,'10:00'), convert_time(this.game_date,'15:00'),
                        convert_time(this.game_date,'20:00'), convert_time(this.game_date,'25:00'), convert_time(this.game_date,'30:00'),
                        convert_time(this.game_date,'35:00'), convert_time(this.game_date,'40:00'), convert_time(this.game_date,'45:00'),
                        convert_time(this.game_date,'50:00'), convert_time(this.game_date,'55:00'), convert_time(this.game_date,'00:00', 4)
                    ],
                    'ticktext': [
                        '',
                        '05:00', '10:00', '15:00', '20:00',
                        '05:00', '10:00', '15:00', '20:00',
                        '05:00', '10:00', '15:00', '20:00'
                    ]
                },
                annotations: this.annotations,
                shapes: [
                    {
                        'type': 'line',
                        'x0': convert_time(this.game_date,'20:00'),
                        'y0': 0,
                        'x1': convert_time(this.game_date,'20:00'),
                        'y1': this.max_shots,
                        'line': {
                            'color': 'rgb(0, 0, 0)',
                            'width': 2,
                        }
                    },
                    {
                        'type': 'line',
                        'x0': convert_time(this.game_date,'40:00'),
                        'y0': 0,
                        'x1': convert_time(this.game_date,'40:00'),
                        'y1': this.max_shots,
                        'line': {
                            'color': 'rgb(0, 0, 0)',
                            'width': 2,
                        }
                    },
                    {
                        'type': 'line',
                        'x0': convert_time(this.game_date,'00:00', 4),
                        'y0': 0,
                        'x1': convert_time(this.game_date,'00:00', 4),
                        'y1': this.max_shots,
                        'line': {
                            'color': 'rgb(0, 0, 0)',
                            'width': 2,
                        }
                    }
                ]
            };

            // If OT add OT line and xaxis ticks
            if(this.current_period == 4){
                layout.xaxis.tickvals.push(convert_time(this.game_date,'05:00', 4));
                layout.xaxis.ticktext.push('05:00');
            }
            Plotly.newPlot('shot_plot', this.graph_data, layout, {displayModeBar: false});
            
        };
        request.send();
    }
    

};

// turn shot times into offesest of game start
function convert_time(game_date, shot_time, period_offset = 1){
    var times = shot_time.split(':');
    var new_date = new Date(game_date.getTime() + (times[0] * 60000) + (times[1] * 1000) + ((period_offset - 1) * 1200000));
    return new_date;
}

function update_time() {
    var now = new Date();
    let hours = now.getHours().toString().padStart(2, '0');
    let minutes = now.getMinutes().toString().padStart(2, '0');
    let seconds = now.getSeconds().toString().padStart(2, '0');
    document.getElementById('update_time').innerHTML = `Last updated: ${hours}:${minutes}:${seconds}`;
}

game.graph();
update_time();

// Update graph every every 30 seconds
window.setInterval(function(){
    game.graph();
    update_time();
    
}, 30000);

// NHL Colors
const pureWhite = {
  hex: '#ffffff',
  rgb: [255, 255, 255],
};

const pureBlack = {
  hex: '#000000',
  rgb: [0, 0, 0],
};

const colors = {
  NJD: {
    fullName: 'New Jersey Devils',
    mainColor: {
      hex: '#E03A3E',
      rgb: [200, 16, 46],
    },
    colors: {
      white: pureWhite,
      black: pureBlack
    }
  },
  ANA: {
    fullName: 'Anaheim Ducks',
    mainColor: {
      hex: '#FC4C02',
      rgb: [252, 76, 2],
    },
    colors: {
      gold: {
        hex: '#B6985A',
        rgb: [182, 152, 90],
      },
      black: pureBlack,
      white: pureWhite
    }
  },
  ARI: {
    fullName: 'Arizona Coyotes',
    mainColor: {
      hex: '#98012E',
      rgb: [152, 1, 46],
    },
    colors: {
      brickRed: {
        hex: '#98012E',
        rgb: [140, 38, 51],
      },
      desertSand: {
        hex: '#e2d6b5',
        rgb: [226, 214, 181],
      },
      black: pureBlack,
      white: pureWhite,
      },
    },
  BOS: {
    fullName: 'Boston Bruns',
    mainColor: {
      hex: '#fcb514',
      rgb: [252, 181, 20],
    },
    colors: {
      gold: {
        hex: '#98012E',
        rgb: [252, 181, 20],
      },
      white: pureWhite,
      black: pureBlack,
    },
  },
  CHI: {
    fullName: 'Chicago Blackhawks',
    mainColor: {
      hex: '#c60c30',
      rgb: [198, 12, 48],
    },
    colors: {
      red: {
        hex: '#c60c30',
        rgb: [198, 12, 48],
      },
      black: pureBlack,
      white: pureWhite,
    },
  },
  BUF: {
    fullName: 'Buffalo Sabres',
    mainColor: {
      hex: '#002d62',
      rgb: [0, 45, 98],
    },
    colors: {
      navy: {
        hex: '#002d62',
        rgb: [0, 45, 98],
      },
      white: pureWhite,
      gold: {
        hex: '#fdb930',
        rgb: [253, 185, 48],
      },
      silver: {
        hex: '#a7a9ac',
        rgb: [167, 169, 172],
      },
    },
  },
  CGY: {
    fullName: 'Calgary Flames',
    mainColor: {
      hex: '#c81022',
      rgb: [200, 16, 46],
    },
    colors: {
      red: {
        hex: '#c81022',
        rgb: [200, 16, 46],
      },
      gold: {
        hex: '#fdbf12',
        rgb: [253, 191, 18],
      },
      black: pureBlack,
      white: pureWhite,
    },
  },
  CAR: {
    fullName: 'Carolina Hurricanes',
    mainColor: {
      hex: '#c8102e',
      rgb: [200, 16, 46],
    },
    white: pureWhite,
    black: pureBlack,
    colors: {
      red: {
        hex: '#c8102e',
        rgb: [200, 16, 46],
      },
    },
  },
  DET: {
    fullName: 'Detroit RedWings',
    mainColor: {
      hex: '#e51837',
      rgb: [229, 24, 55],
    },
    colors: {
      red: {
        hex: '#e51837',
        rgb: [229, 24, 55],
      },
      white: pureWhite,
    },
  },
  COL: {
    fullName: 'Colorado Avalance',
    mainColor: {
      hex: '#822433',
      rgb: [130, 36, 51],
    },
    colors: {
      burgundy: {
        hex: '#822433',
        rgb: [130, 36, 51],
      },
      blue: {
        hex: '#165788',
        rgb: [22, 87, 136],
      },
      silver: {
        hex: '#85888B',
        rgb: [133, 136, 139],
      },
      black: pureBlack,
    },
  },
  CBJ: {
    fullName: 'Columbus Blue Jackets',
    mainColor: {
      hex: '#041e42',
      rgb: [4, 30, 66],
    },
    colors: {
      blue: {
        hex: '#041e42',
        rgb: [4, 30, 66],
      },
      red: {
        hex: '#c8102e',
        rgb: [200,16,46],
      },
      silver: {
        hex: '#8D9093',
        rgb: [141,144,147],
      },
      black: pureBlack,
      white: pureWhite,
    },
  },
  DAL: {
    fullName: 'Dallas Stars',
    mainColor: {
      hex: '#016F4A',
      rgb: [1, 111, 74],
    },
    colors: {
      green: {
        hex: '#016F4A',
        rgb: [255, 184, 28],
      },
      silver: {
        hex: '#A7A8AC',
        rgb: [167, 168, 172],
      },
      white: pureWhite,
    },
  },
  EDM: {
    fullName: 'Edmonton Oilers',
    mainColor: {
      hex: '#013E7F',
      rgb: [1, 62, 127],
    },
    colors: {
      blue: {
        hex: '#013E7F',
        rgb: [1, 62, 127],
      },
      orange: {
        hex: '#eb6e1e',
        rgb: [235, 110, 30],
      },
      white: pureWhite,
    },
  },
  FLA: {
    fullName: 'Florida Panthers',
    mainColor: {
      hex: '#C51230',
      rgb: [229, 26, 56],
    },
    colors: {
      red: {
        hex: '#C51230',
        rgb: [229, 26, 56],
      },
      blue: {
        hex: '#002D62',
        rgb: [0, 45,98],
      },
      gold: {
        hex: '#F1B310',
        rgb: [212,160,15],
      },
      white: pureWhite,
    },
  },
  MEM: {
    fullName: 'Los Angeles Kings',
    mainColor: {
      hex: '#23375b',
      rgb: [35, 55, 91],
    },
    colors: {
      silver: {
        hex: '#B2B7BB',
        rgb: [35, 55, 91],
      },
      white: pureWhite,
      black: pureBlack,
    },
  },
  MIN: {
    fullName: 'Minnesota Wild',
    mainColor: {
      hex: '#C51230',
      rgb: [197, 18, 48],
    },
    colors: {
      ironRangeRed: {
        hex: '#862633',
        rgb: [197,18,48],
      },
      forestGreen: {
        hex: '#004F30',
        rgb: [0, 79, 48],
      },
      harvestGold: {
        hex: '#004F30',
        rgb: [241, 179, 16],
      },
      minnesotaWheat: {
        hex: '#EEE3C7',
        rgb: [238, 227, 199],
      },
      white: pureWhite,
    },
  },
  MTL: {
    fullName: 'Montreal Canadiens',
    mainColor: {
      hex: '#C51230',
      rgb: [197,18,48],
    },
    colors: {
      red: {
        hex: '#C51230',
        rgb: [197,18,48],
      },
      blue: {
        hex: '#083A81',
        rgb: [8,58,121],
      },
      white: pureWhite,
    },
  },
  NSH: {
    fullName: 'Nashville Predators',
    mainColor: {
      hex: '#FDBB30',
      rgb: [253, 187, 48],
    },
    colors: {
      gold: {
        hex: '#FDBB30',
        rgb: [253, 187, 48],
      },
      navy: {
        hex: '#002D62',
        rgb: [0, 45, 98],
      },
      white: pureWhite,
    },
  },
  NYI: {
    fullName: 'New York Islanders',
    mainColor: {
      hex: '#F57D31',
      rgb: [245,125,49],
    },
    colors: {
      orange: {
        hex: '#F57D31',
        rgb: [245,125,49],
      },
      blue: {
        hex: '#00529B',
        rgb: [0,82,155],
      },
      white: pureWhite,
    },
  },
  NYR: {
    fullName: 'New York Rangers',
    mainColor: {
      hex: '#E51837',
      rgb: [230, 57, 63],
    },
    colors: {
      red: {
        hex: '#E51837',
        rgb: [230,57,63],
      },
      blue: {
        hex: '#0161AB',
        rgb: [1, 97, 171],
      },
      white: pureWhite,
    },
  },
  OTT: {
    fullName: 'Ottawa Senators',
    mainColor: {
      hex: '#E51837',
      rgb: [229, 24, 55],
    },
    colors: {
      red: {
        hex: '#E51837',
        rgb: [229, 24, 55],
      },
      gold: {
        hex: '#D4A00F',
        rgb: [212, 160, 15],
      },
      white: pureWhite,
      black: pureBlack,
    },
  },
  PHI: {
    fullName: 'Philadelphia Flyers',
    mainColor: {
      hex: '#F74902',
      rgb: [247, 73, 2],
    },
    colors: {
      flyersOrange: {
        hex: '#F74902',
        rgb: [247, 73, 2],
      },
      white: pureWhite,
      black: pureBlack,
    },
  },
  PIT: {
    fullName: 'Pittsburgh Penguins',
    mainColor: {
      hex: '#CFC493',
      rgb: [207, 196, 147],
    },
    colors: {
      gold: {
        hex: '#CFC493',
        rgb: [207, 196, 147],
      },
      black: pureBlack,
      white: pureWhite,
      yellow: {
        hex: '#FFB81C',
        rgb: [255, 184, 28],
      },
    },
  },
  STL: {
    fullName: 'St. Louis Blues',
    mainColor: {
      hex: '#00529C',
      rgb: [0, 82, 156],
    },
    colors: {
      blue: {
        hex: '#00529C',
        rgb: [253, 185, 48],
      },
      gold: {
        hex: '#FDB930',
        rgb: [253, 185, 48],
      },
      navy: {
        hex: '#002D62',
        rgb: [0, 45, 98],
      },
      white: pureWhite,
    },
  },
  SJS: {
    fullName: 'San Jose Sharks',
    mainColor: {
      hex: '#007889',
      rgb: [0, 120, 137],
    },
    colors: {
      pacificTeal: {
        hex: '#007889',
        rgb: [0, 120, 137],
      },
      orange: {
        hex: '#F4901E',
        rgb: [244, 144, 30],
      },
      white: pureWhite,
      black: pureBlack,
    },
  },
  TBL: {
    fullName: 'Tampa Bay Lightning Kings',
    mainColor: {
      hex: '#003D7C',
      rgb: [0,61,124],
    },
    colors: {
      blue: {
        hex: '#003D7C',
        rgb: [0,61,124],
      },
      white: pureWhite,
      black: pureBlack,
    },
  },
  TOR: {
    fullName: 'Toronto Maple Leafs',
    mainColor: {
      hex: '#013E7F',
      rgb: [1, 62, 127],
    },
    colors: {
      blue: {
        hex: '#013E7F',
        rgb: [1, 62, 127],
      },
      white: pureWhite,
    },
  },
  VAN: {
    fullName: 'Vancouver Canucks',
    mainColor: {
      hex: '#003E7E',
      rgb: [0, 62, 126],
    },
    colors: {
      blue: {
        hex: '#003E7E',
        rgb: [0, 62, 126],
      },
      green: {
        hex: '#008852',
        rgb: [0, 136, 82],
      },
      silver: {
        hex: '#ADAEB2',
        rgb: [173, 174, 178],
      },
      white: pureWhite,
    },
  },
  VGK: {
    fullName: 'Vegas Golden Knights',
    mainColor: {
      hex: '#333F48',
      rgb: [51, 63, 72],
    },
    colors: {
      navy: {
        hex: '#333F48',
        rgb: [51, 63, 72],
      },
      black: pureBlack,
      gold: {
        hex: '#f9a01b',
        rgb: [137, 115, 76],
      },
      red: {
        hex: '#C8102E',
        rgb: [200, 16, 46],
      },
      white: pureWhite,
    },
  },
  WSH: {
    fullName: 'Washington Capitals',
    mainColor: {
      hex: '#002147',
      rgb: [0, 33, 71],
    },
    colors: {
      navyBlue: {
        hex: '#002147',
        rgb: [0, 33, 71],
      },
      red: {
        hex: '#C60C30',
        rgb: [198, 12, 48],
      },
      white: pureWhite,
    },
  },
  WPG: {
    fullName: 'Winnepeg Jets',
    mainColor: {
      hex: '#002D62',
      rgb: [0, 45, 98],
    },
    colors: {
      polarNightBlue: {
        hex: '#002D62',
        rgb: [0, 45, 98],
      },
      aviatorBlue: {
        hex: '#006EC8',
        rgb: [0,110,200],
      },
      silver: {
        hex: '#8D8D8F',
        rgb: [141, 141, 143],
      },
      white: pureWhite,
    },
  },
};
