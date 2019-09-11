const espn = require('espnff')
const path = require('path')
const jsonfile = require('jsonfile')
const machine = require('machine')
const moment = require('moment')
const argv = require('yargs').argv

const config_path = path.resolve(__dirname, argv.config ? `config.${argv.config}` : './config')
const config = require(config_path)

console.log(config)
const current_week = moment().diff(config.week_one, 'weeks')

const tradePlayers = (team, add, remove) => {
  team = [...team, ...add]
  team = team.filter(player => !remove.includes(player))
  return team
}

const outputPlayerValues = (add, remove) => {
  const players = [...add, ...remove]
  console.log('\nPlayer VOR Trade Value')
  players.forEach((p) => {
    console.log(`${p}:`)
  })
  console.log('\n\n')
}

const outputLineup = (original_lineup, new_lineup) => {
  console.log(`QB:    ${original_lineup.qb.fantasy_points.toString().padEnd(4)} - ${original_lineup.qb.player_name.padEnd(35)}${new_lineup.qb.fantasy_points} - ${new_lineup.qb.player_name}`)
  console.log(`RB1:   ${original_lineup.rb1.fantasy_points.toString().padEnd(4)} - ${original_lineup.rb1.player_name.padEnd(35)}${new_lineup.rb1.fantasy_points} - ${new_lineup.rb1.player_name}`)
  console.log(`RB2:   ${original_lineup.rb2.fantasy_points.toString().padEnd(4)} - ${original_lineup.rb2.player_name.padEnd(35)}${new_lineup.rb2.fantasy_points} - ${new_lineup.rb2.player_name}`)
  console.log(`WR1:   ${original_lineup.wr1.fantasy_points.toString().padEnd(4)} - ${original_lineup.wr1.player_name.padEnd(35)}${new_lineup.wr1.fantasy_points} - ${new_lineup.wr1.player_name}`)
  console.log(`WR2:   ${original_lineup.wr2.fantasy_points.toString().padEnd(4)} - ${original_lineup.wr2.player_name.padEnd(35)}${new_lineup.wr2.fantasy_points} - ${new_lineup.wr2.player_name}`)
  console.log(`Flex:  ${original_lineup.flex.fantasy_points.toString().padEnd(4)} - ${original_lineup.flex.player_name.padEnd(35)}${new_lineup.flex.fantasy_points} - ${new_lineup.flex.player_name}`)
  console.log(`TE:    ${original_lineup.te.fantasy_points.toString().padEnd(4)} - ${original_lineup.te.player_name.padEnd(35)}${new_lineup.te.fantasy_points} - ${new_lineup.te.player_name}`)
  if (original_lineup.k) console.log(`K:     ${original_lineup.k.fantasy_points.toString().padEnd(4)} - ${original_lineup.k.player_name.padEnd(35)}${new_lineup.k.fantasy_points} - ${new_lineup.k.player_name}`)
  console.log(`DST:   ${original_lineup.dst.fantasy_points.toString().padEnd(4)} - ${original_lineup.dst.player_name.padEnd(35)}${new_lineup.dst.fantasy_points} - ${new_lineup.dst.player_name}`)
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
  console.log(`Projected Record: ${n.total_wins}-${n.total_losses} (${o.total_wins}-${o.total_losses})`)
  console.log(`Playoff Odds: ${(n.playoff_odds * 100).toFixed(1)} (${playoff_delta}%)`)
  console.log(`First Round Bye Odds: ${(n.first_round_bye_odds * 100).toFixed(1)} (${first_round_delta}%)`)
  console.log(`Championship Odds: ${(n.championship_odds * 100).toFixed(1)} (${championship_delta}%)`)
  console.log(`Total Points: ${n.total_points} (${points_delta})`)
}

const outputWeeklyResults = (o, n, week, teams) => {
  const me = o.home_id === config.myId ? 'home' : 'away'
  const opponent_id = me === 'home' ? o.away_id : o.home_id
  const opponent = teams[opponent_id].team
  const opponent_projection = (me === 'home' ? o.away_lineup.total : o.home_lineup.total).toFixed(1)
  const current_odds = n[`${me}_team_probability`]
  const prob_delta = current_odds - o[`${me}_team_probability`]

  const orig_point = o[`${me}_lineup`].total.toFixed(1)
  const new_point = n[`${me}_lineup`].total.toFixed(1)
  const point_delta = (new_point - orig_point).toFixed(1)

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
  const teams = await espn.roster.get(config.espn)
  const data = await espn.schedule.get(config.espn)
  const { schedule, standings } = data.formatted

  const current_team_results = await machine.simulateSeason({ current_week, leagueId, teams: teams.formatted, standings, schedule, cookie: config.cookie })

  let traded_teams = JSON.parse(JSON.stringify(teams.formatted))
  traded_teams[config.myId] = tradePlayers(
    traded_teams[config.myId],
    config.add,
    config.remove
  )

  if (config.opponentId) {
    traded_teams[config.opponentId] = tradePlayers(
      traded_teams[config.opponentId],
      config.remove,
      config.add
    )
  }

  const new_team_results = await machine.simulateSeason({ current_week, leagueId, teams: traded_teams, standings, schedule, cookie: config.cookie })
  const original_team = current_team_results.filter((team) => team.team_id === config.myId)[0]
  const new_team = new_team_results.filter((team) => team.team_id === config.myId)[0]

  outputSeasonResults(original_team, new_team)

  outputPlayerValues(config.add, config.remove)

  for (const matchup in original_team.matchups) {
    const o = original_team.matchups[matchup]
    const n = new_team.matchups[matchup]
    outputWeeklyResults(o, n, matchup, standings)
  }

  //TODO: output start counts
}

run().catch((err) => console.log(err))
