#!/usr/bin/env node

const Table = require('cli-table')
const csv = require('csv')
const fs = require('fs')
const program = require('commander')
const path = require('path')
const sqlite = require('sqlite3')
const pkg = require('./package.json')

const {Database} = sqlite

const db = new Database(path.resolve(__dirname, 'data/db.sqlite'))

program
  .version(pkg.version)

program
  .command('select <sample>')
  .description('The number of students to select')
  .alias('s')
  .action((sample) => {
    // TODO better algorithmus needed, this is only fair after 1000 exams
    const stmt = `SELECT
      name,
      count
      FROM students
      ORDER BY (RANDOM() * "count") DESC
      LIMIT ${parseInt(sample)}
    `

    const students = []

    const updateStmt = db.prepare('UPDATE students SET count=count+1 WHERE name=?')

    db
      .each(
        stmt,
        (err, row) => {
          students.push(row)
          updateStmt.run(row.name)
        }, (err) => {
          if (err) {
            throw new Error(err.message)
          }

          updateStmt.finalize()

          const table = new Table({
            head: ['Name', 'Count'],
            chars: {
              'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗',
              'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝',
              'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼',
              'right': '║', 'right-mid': '╢', 'middle': '│'
            }
          })

          students.map(student => table.push([student.name, student.count]))
          console.log(table.toString()) // eslint-disable-line no-console
        })
  })

program
  .command('reset <name> [count]')
  .description('Reset student counter')
  .alias('r')
  .action((name, count = 0) => {
    const stmt = db.prepare('UPDATE students SET count=? WHERE name=?')
    stmt.run(count, name)
    stmt.finalize()
  })

program
  .command('reset-all [count]')
  .description('Reset all student counters')
  .alias('ra')
  .action((count = 0) => {
    const stmt = db.prepare('UPDATE students SET count=?')
    stmt.run(count)
    stmt.finalize()
  })

program
  .command('load <file>')
  .description('Import students from CSV')
  .alias('l')
  .option('-s, --skip', 'Skip first line of data')
  .action((file, options) => {
    const filePath = path.resolve(file)
    fs.readFile(file, 'utf8', (err, data) => {
      if (err) {
        throw new Error(`Cannot read from file: ${filePath}`)
      }

      const parserOptions = {
        skip_empty_lines: true,
        from: options.skip ? 2 : 1
      }
      csv.parse(data, parserOptions, (err, data) => {
        const stmt = db.prepare('INSERT INTO students VALUES(?, ?)')
        data.forEach(row => stmt.run(row[0], row[1]))
        stmt.finalize()
      })
    })
  })

program
  .command('export <file>')
  .description('Export data as CSV')
  .alias('e')
  .action((file) => {
    const filePath = path.resolve(file)
    let data = '"Name","Count"'

    db
      .each(
        'SELECT name,"count" from students',
        (err, row) => {
          data += `\n"${row.name}",${row.count}`
        }, (err) => {
          if (err) {
            throw new Error(err.message)
          }

          fs.writeFile(file, data, (err) => {
            if (err) {
              throw new Error(`Cannot write to file: ${filePath}`)
            }
          })
        })
  })


program
  .command('help')
  .description('Prints this help')
  .alias('h')
  .action(() => {
    program.outputHelp(txt => txt)
  })

function init() {
  return new Promise((resolve) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS
        students(
          name TEXT PRIMARY KEY ASC,
          count INTEGER
        )`
      )
      resolve()
    })
  })
}

function run() {
  program.parse(process.argv)

  if (!process.argv.slice(2).length) {
    program.outputHelp(txt => txt)
  }
}

const cli = Promise.resolve()

cli
  .then(init)
  .then(run)
