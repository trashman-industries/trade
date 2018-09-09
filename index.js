const espn = require('espnff')
const path = require('path')
const jsonfile = require('jsonfile')
const machine = require('machine')
const moment = require('moment')

const config = require('./config')
const current_week = moment().diff(config.week_one, 'weeks')

//const data_path = path.resolve(__dirname, '../data/power_rankings.json')

const tradePlayers = (team, add, remove) => {
  team = [...team, ...add]
  team = team.filter(player => !remove.includes(player))
  return team
}

const outputLineup = (original_lineup, new_lineup) => {
  console.log(`QB - ${original_lineup.qb.player_name} (${original_lineup.qb.fantasy_points})\t\t\t${new_lineup.qb.player_name} (${new_lineup.qb.fantasy_points})`)
  console.log(`RB1 - ${original_lineup.rb1.player_name} (${original_lineup.rb1.fantasy_points})\t\t\t${new_lineup.rb1.player_name} (${new_lineup.rb1.fantasy_points})`)
  console.log(`RB2 - ${original_lineup.rb2.player_name} (${original_lineup.rb2.fantasy_points})\t\t\t${new_lineup.rb2.player_name} (${new_lineup.rb2.fantasy_points})`)
  console.log(`WR1 - ${original_lineup.wr1.player_name} (${original_lineup.wr1.fantasy_points})\t\t\t${new_lineup.wr1.player_name} (${new_lineup.wr1.fantasy_points})`)
  console.log(`WR2 - ${original_lineup.wr2.player_name} (${original_lineup.wr2.fantasy_points})\t\t\t${new_lineup.wr2.player_name} (${new_lineup.wr2.fantasy_points})`)
  console.log(`Flex - ${original_lineup.flex.player_name} (${original_lineup.flex.fantasy_points})\t\t\t${new_lineup.flex.player_name} (${new_lineup.flex.fantasy_points})`)
  console.log(`TE - ${original_lineup.te.player_name} (${original_lineup.te.fantasy_points})\t\t\t${new_lineup.te.player_name} (${new_lineup.te.fantasy_points})`)
  console.log(`K - ${original_lineup.k.player_name} (${original_lineup.k.fantasy_points})\t\t\t${new_lineup.k.player_name} (${new_lineup.k.fantasy_points})`)
  console.log(`DST - ${original_lineup.dst.player_name} (${original_lineup.dst.fantasy_points})\t\t\t${new_lineup.dst.player_name} (${new_lineup.dst.fantasy_points})`)
  console.log('\n')
  console.log('\n')
}

const outputSeasonResults = (o, n) => {
  console.log('\n\n')
  console.log(`================= Season Report  =================`)
  const playoff_delta = ((n.playoff_odds - o.playoff_odds) * 100).toFixed(1)
  const first_round_delta = ((n.first_round_bye_odds - o.first_round_bye_odds) * 100).toFixed(1)
  const championship_delta = ((n.championship_odds - o.championship_odds) * 100).toFixed(1)
  const points_delta = (n.total_points - o.total_points).toFixed(1)
  console.log(`Playoff Odds: ${(n.playoff_odds * 100).toFixed(1)} (${playoff_delta}%)`)
  console.log(`First Round Bye Odds: ${(n.first_round_bye_odds * 100).toFixed(1)} (${first_round_delta}%)`)
  console.log(`Championship Odds: ${(n.championship_odds * 100).toFixed(1)} (${championship_delta}%)`)
  console.log(`Total Points: ${n.total_points} (${points_delta})`)
}

const outputWeeklyResults = (o, n, week) => {
  const me = o.home_id === config.myId ? 'home' : 'away'
  const opponent = me === 'home' ? o.away_team : o.home_team
  const opponent_projection = (me === 'home' ? o.away_lineup.total : o.home_lineup.total).toFixed(1)
  const current_odds = n[`${me}_team_probability`]
  const prob_delta = current_odds - o[`${me}_team_probability`]

  const orig_point = n[`${me}_lineup`].total.toFixed(1)
  const new_point = o[`${me}_lineup`].total.toFixed(1)
  const point_delta = (orig_point - new_point).toFixed(1)

  console.log(`\n\n================= Week ${week} =================`)

  console.log(`Odds: ${(current_odds * 100).toFixed(1)}% (${(prob_delta * 100).toFixed(1)}%)`)
  console.log(`Projection: ${new_point} (${point_delta})`)
  console.log(`\nOpponent: ${opponent}`)
  console.log(`Opponent Projection: ${opponent_projection}`)

  const original_lineup = o[`${me}_lineup`]
  const new_lineup = n[`${me}_lineup`]
  console.log('\n')
  outputLineup(original_lineup, new_lineup)
}

const { leagueId } = config.pff

const run = async () => {
  const teams = await espn.roster.get(config.espn.leagueId)
  const standings = await espn.standings.get(config.espn)
  const schedule = await espn.schedule.getByLeague(config.espn)
  const current_team_results = await machine.simulateSeason({ current_week, leagueId, teams, standings, schedule })

  let traded_teams = JSON.parse(JSON.stringify(teams))
  traded_teams[config.myId] = tradePlayers(
    traded_teams[config.myId],
    config.add,
    config.remove
  )
  traded_teams[config.opponentId] = tradePlayers(
    traded_teams[config.opponentId],
    config.remove,
    config.add
  )

  const new_team_results = await machine.simulateSeason({ current_week, leagueId, teams: traded_teams, standings, schedule })

  const original_team = current_team_results.filter((team) => team.team_id === config.myId)[0]
  const new_team = new_team_results.filter((team) => team.team_id === config.myId)[0]

  outputSeasonResults(original_team, new_team)

  for (const matchup in original_team.matchups) {
    const o = original_team.matchups[matchup]
    const n = new_team.matchups[matchup]
    outputWeeklyResults(o, n, matchup)
  }

  //TODO: output start counts
}

try {
  run()
} catch (e) {
  console.log(e)
}
