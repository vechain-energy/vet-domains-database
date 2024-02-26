import { Command } from "commander"
import figlet from "figlet"
import { syncResolvers } from "./lib/syncResolvers"
import { syncResolverUpdates } from "./lib/syncResolverUpdates"
import { setupDatabase } from "./lib/setupDatabase"
import chalk from 'chalk'

console.log(chalk.keyword('orange')(figlet.textSync("vet.domains")))

const program = new Command()
program
    .version("1.0.0")
    .description("vet.domains name indexer")
    .option("-n, --node <url>", "Node URL of the blockchain", "https://node-mainnet.vechain.energy")
    .option("-c, --contract <address>", "Registry Address", "0xa9231da8BF8D10e2df3f6E03Dd5449caD600129b")
    .option("-d, --database <file>", "SQLite storage", "index.db")
    .parse(process.argv)

const options = program.opts()

if (!options.node || !options.contract || !options.database) {
    console.log('Please provide all required options. Use --help for more information')
    process.exit(1)
}

async function startIndex() {
    console.log(chalk.green("Starting Indexer"))
    console.log("")
    console.log("Node:", chalk.grey(options.node))
    console.log("Registry:", chalk.grey(options.contract))
    console.log("Database:", chalk.grey(options.database))
    console.log("")

    const db = await setupDatabase(options.database)
    await syncResolvers({ db, node: options.node, contract: options.contract })
    await syncResolverUpdates({ db, node: options.node })
}

startIndex().catch(console.error)
