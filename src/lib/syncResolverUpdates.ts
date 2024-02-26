import type { Database } from 'better-sqlite3';
import { Interface, namehash } from "ethers"
import chalk from 'chalk'
import ora from 'ora';

const resolver = new Interface([
    'event AddrChanged(bytes32 indexed node, address a)',
    'event NameChanged(bytes32 indexed node, string name)',
])

export async function syncResolverUpdates({ db, node }: { db: Database, node: string }) {
    const spinner = ora('Loading resolvers').start();
    const { lastBlock } = db.prepare('SELECT MAX(blockHeight) as lastBlock FROM nodeNames').get() as { lastBlock: number | null }
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
                    { topic0: resolver.getEvent('NameChanged')!.topicHash },
                    { topic0: resolver.getEvent('AddrChanged')!.topicHash }

                ]
            })
        }).then(res => res.json()) as EventLog[];

        for (const rawEvent of events) {
            try {
                const event = resolver.parseLog(rawEvent);

                if (event?.name === 'NameChanged') {
                    const log = event.args;
                    spinner.text = `Name changed for: ${log.node} to ${log.name}`;

                    // store the record setting
                    db.prepare('INSERT OR REPLACE INTO nodeNames (resolverAddress, node, name, blockHeight) VALUES (:resolverAddress, :node, :name, :blockNumber)').run({ node: log.node, name: log.name, resolverAddress: rawEvent.address, blockNumber: rawEvent.meta.blockNumber })

                    // update the node entry to reflect the new name
                    db.prepare('UPDATE nodes SET name = :name, blockHeight = :blockNumber WHERE node = :node AND resolverAddress LIKE :resolverAddress').run({ node: log.node, name: log.name, resolverAddress: rawEvent.address, blockNumber: rawEvent.meta.blockNumber });
                }

                else if (event?.name === 'AddrChanged') {
                    const log = event.args;
                    spinner.text = `Address changed for: ${log.node} to ${log.a}`;
                    const reverseNode = namehash(`${log.a.slice(2).toLowerCase()}.addr.reverse`)

                    // store the record setting
                    db.prepare('INSERT OR REPLACE INTO nodeAddresses (resolverAddress, node, address, blockHeight) VALUES (:resolverAddress, :node, :address, :blockNumber)').run({ node: log.node, address: log.a, resolverAddress: rawEvent.address, blockNumber: rawEvent.meta.blockNumber });

                    // update the node entry to reflect the new address
                    db.prepare('UPDATE nodes SET address = :address, reverseNode = :reverseNode, blockHeight = :blockNumber WHERE node = :node AND resolverAddress LIKE :resolverAddress').run({ node: log.node, address: log.a, reverseNode, resolverAddress: rawEvent.address, blockNumber: rawEvent.meta.blockNumber });
                }
            }
            catch {/* ignore */ }
        }

        offset += 256
    } while (events.length > 0)

    spinner.succeed(chalk.green('Resolver records sync complete'));
}
