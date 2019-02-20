/*jshint esversion: 6 */

var schedule_date = new URLSearchParams(window.location.search).get('date');
var request = new XMLHttpRequest();

if(schedule_date){
    request.open('GET', `https://statsapi.web.nhl.com/api/v1/schedule?date=${schedule_date}`, true);
} else {
    request.open('GET', 'https://statsapi.web.nhl.com/api/v1/schedule', true);
}


request.onload = function () {
    var data = JSON.parse(this.response);
    
    games = data.dates[0].games;
    date = new Date(data.dates[0].games[0].gameDate);

    // Prev
    let year = date.getFullYear().toString().padStart(2, '0');
    let month = (date.getMonth() + 1).toString().padStart(2, '0');
    let day = (date.getDate() - 1).toString().padStart(2, '0');

    document.getElementById('prev').href = `?date=${year}-${month}-${day}`;

    // Next
    year = date.getFullYear().toString().padStart(2, '0');
    month = (date.getMonth() + 1).toString().padStart(2, '0');
    day = (date.getDate() + 1).toString().padStart(2, '0');

    document.getElementById('next').href = `?date=${year}-${month}-${day}`;

    // Today
    let today = new Date();
    year = today.getFullYear().toString().padStart(2, '0');
    month = (today.getMonth() + 1).toString().padStart(2, '0');
    day = (today.getDate()).toString().padStart(2, '0');

    document.getElementById('today').href = `?date=${year}-${month}-${day}`;

    // Set Title
    document.getElementById('title').innerHTML = `NHL Games ${date.toDateString()}`;

    var game_tables = [];
    var game_Pks = [];

    games.forEach(game => {
        var gamePk = game.gamePk;
        var away_team_name = game.teams.away.team.name;
        var away_team_score = game.teams.away.score;
        var home_team_name = game.teams.home.team.name;
        var home_team_score = game.teams.home.score;
        var game_state = game.status.detailedState;

        if(game_state == 'Scheduled'){
            game_date = new Date(game.gameDate);
            game_state = game_date.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
        }

        game_Pks.push(gamePk);
        game_tables.push(`<table class="boxscore" id=${gamePk}><tr><td id="team">${away_team_name}</td><td id="score">${away_team_score}</td><td rowspan="2" id="status">${game_state}</td></tr><tr><td id="team">${home_team_name}</td><td id="score">${home_team_score}</td></tr></table>`);
    });

    // DOM Stuff
    var run_count = 0;
    var table = document.getElementById('lineup');

    while(run_count < Math.ceil((game_tables.length / 3.0))){
        var row = table.insertRow();
        for(var i = 0; i < 3; i++){
            var newCell = row.insertCell();
            newCell.id = 'lineup';
            newCell.innerHTML = game_tables[i + run_count * 3] || '';
        }
        run_count++;
    }

    game_Pks.forEach(id => {
        document.getElementById(id).onclick = function() {
            document.location.href = `/sharks_stats/stats.html?gamePk=${id}`;
        };
    });

};

request.send();
