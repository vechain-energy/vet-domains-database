import type { Database } from 'better-sqlite3';
import { Interface } from "ethers"
import chalk from 'chalk'
import ora from 'ora';

const registry = new Interface([
    'event NewResolver(bytes32 indexed node, address resolver)'
])

export async function syncResolvers({ db, node, contract }: { db: Database, node: string, contract: string }) {
    const spinner = ora('Loading resolvers').start();

    const { lastBlock } = db.prepare('SELECT MAX(blockHeight) as lastBlock FROM nodeResolvers').get() as { lastBlock: number | null }
    const currentBlock = await fetch(`${node}/blocks/best`).then(res => res.json()).then((res: { number: string }) => parseInt(res.number));

    let events: EventLog[] = [];
    let offset = 0
    
    do {
        spinner.text = `Fetching events at offset ${offset}`;
        events = await fetch(`${node}/logs/event`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "range": {
                    "unit": "block",
                    "from": (lastBlock || 0) + 1,
                    "to": currentBlock
                },
                "order": "asc",
                "options": {
                    offset,
                    "limit": 256,
                },
                "criteriaSet": [
                    {
                        address: contract,
                        topic0: registry.getEvent('NewResolver')!.topicHash
                    }
                ]
            })
        }).then(res => res.json()) as EventLog[];

        for (const rawEvent of events) {
            const event = registry.parseLog(rawEvent);

            if (event?.name === 'NewResolver') {
                const log = event.args;
                spinner.text = `Resolver update for: ${log.node}`;
                db.prepare('INSERT OR REPLACE INTO nodeResolvers (node, resolverAddress, blockHeight) VALUES (:node, :resolver, :blockNumber)').run({ node: log.node, resolver: log.resolver.toLowerCase(), blockNumber: rawEvent.meta.blockNumber });
                db.prepare('INSERT OR REPLACE INTO nodes (node, resolverAddress, blockHeight) VALUES (:node, :resolver, :blockNumber)').run({ node: log.node, resolver: log.resolver.toLowerCase(), blockNumber: rawEvent.meta.blockNumber });
            }
        }

        offset += 256
    } while (events.length > 0)

    spinner.succeed(chalk.green('Resolver reference sync complete'));
}
