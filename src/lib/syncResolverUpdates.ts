import type { Database } from 'better-sqlite3';
import { Interface, namehash } from "ethers"
import chalk from 'chalk'
import ora from 'ora';

const resolver = new Interface([
    'event AddrChanged(bytes32 indexed node, address a)',
    'event NameChanged(bytes32 indexed node, string name)',
    'event TextChanged(bytes32 indexed node, string indexed indexedKey, string key, string value)',
    'event ContenthashChanged(bytes32 indexed node, bytes hash)',
    'event DNSRecordChanged(bytes32 indexed node, bytes name, uint16 resource, bytes record)',
    'event DNSRecordDeleted(bytes32 indexed node, bytes name, uint16 resource)',
    'event DNSZonehashChanged(bytes32 indexed node, bytes lastzonehash, bytes zonehash)',
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
                    { topic0: resolver.getEvent('AddrChanged')!.topicHash },
                    { topic0: resolver.getEvent('TextChanged')!.topicHash },
                    { topic0: resolver.getEvent('ContenthashChanged')!.topicHash },
                    { topic0: resolver.getEvent('DNSRecordChanged')!.topicHash },
                    { topic0: resolver.getEvent('DNSRecordDeleted')!.topicHash },
                    { topic0: resolver.getEvent('DNSZonehashChanged')!.topicHash },
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
                    db.prepare('INSERT OR REPLACE INTO nodeNames (resolverAddress, node, name, blockHeight) VALUES (:resolverAddress, :node, :name, :blockNumber)').run({ node: log.node, name: log.name, resolverAddress: rawEvent.address.toLowerCase(), blockNumber: rawEvent.meta.blockNumber })

                    // update the node entry to reflect the new name
                    db.prepare('UPDATE nodes SET name = :name, blockHeight = :blockNumber WHERE node = :node AND resolverAddress LIKE :resolverAddress').run({ node: log.node, name: log.name, resolverAddress: rawEvent.address.toLowerCase(), blockNumber: rawEvent.meta.blockNumber });
                }

                else if (event?.name === 'AddrChanged') {
                    const log = event.args;
                    spinner.text = `Address changed for: ${log.node} to ${log.a}`;
                    const reverseNode = namehash(`${log.a.slice(2).toLowerCase()}.addr.reverse`)

                    // store the record setting
                    db.prepare('INSERT OR REPLACE INTO nodeAddresses (resolverAddress, node, address, blockHeight) VALUES (:resolverAddress, :node, :address, :blockNumber)').run({ node: log.node, address: log.a, resolverAddress: rawEvent.address.toLowerCase(), blockNumber: rawEvent.meta.blockNumber });

                    // update the node entry to reflect the new address
                    db.prepare('UPDATE nodes SET address = :address, reverseNode = :reverseNode, blockHeight = :blockNumber WHERE node = :node AND resolverAddress LIKE :resolverAddress').run({ node: log.node, address: log.a, reverseNode, resolverAddress: rawEvent.address.toLowerCase(), blockNumber: rawEvent.meta.blockNumber });
                }

                else if (event?.name === 'TextChanged') {
                    const log = event.args;
                    const type = 'text'
                    spinner.text = `Text changed for: ${log.node} ${log.key}=${log.value}`;

                    // store the record setting
                    db.prepare('INSERT OR REPLACE INTO records (node, resolverAddress, type, key, value, blockHeight) VALUES (:node, :resolverAddress, :type, :key, :value, :blockNumber)').run({ node: log.node, address: log.a, resolverAddress: rawEvent.address.toLowerCase(), type, key: log.key, value: log.value, blockNumber: rawEvent.meta.blockNumber });
                }

                else if (event?.name === 'ContenthashChanged') {
                    const log = event.args;
                    const type = 'contenthash'
                    const key = ''
                    const value = Buffer.from(log.hash.slice(2), 'hex').toString()
                    spinner.text = `Content Hash changed for: ${log.node} ${log.hash}`;

                    // store the record setting
                    if (!value) {
                        db.prepare('DELETE FROM records WHERE node = :node, resolverAddress = :resolverAddress, type = :type, key = :key').run({ node: log.node, address: log.a, resolverAddress: rawEvent.address.toLowerCase(), type, key, value, blockNumber: rawEvent.meta.blockNumber });
                    }
                    else {
                        db.prepare('INSERT OR REPLACE INTO records (node, resolverAddress, type, key, value, blockHeight) VALUES (:node, :resolverAddress, :type, :key, :value, :blockNumber)').run({ node: log.node, address: log.a, resolverAddress: rawEvent.address.toLowerCase(), type, key, value, blockNumber: rawEvent.meta.blockNumber });

                    }
                }

                else if (event?.name === 'DNSRecordChanged') {
                    const log = event.args;
                    const type = 'dns'
                    const key = [Buffer.from(log.name.slice(2), 'hex').toString(), log.resource].join(' ')
                    const value = Buffer.from(log.record.slice(2), 'hex').toString()
                    spinner.text = `DNS Record changed for: ${key} ${value}`;

                    // store the record setting
                    if (!value) {
                        db.prepare('DELETE FROM records WHERE node = :node, resolverAddress = :resolverAddress, type = :type, key = :key').run({ node: log.node, address: log.a, resolverAddress: rawEvent.address.toLowerCase(), type, key, value, blockNumber: rawEvent.meta.blockNumber });
                    }
                    else {
                        db.prepare('INSERT OR REPLACE INTO records (node, resolverAddress, type, key, value, blockHeight) VALUES (:node, :resolverAddress, :type, :key, :value, :blockNumber)').run({ node: log.node, address: log.a, resolverAddress: rawEvent.address.toLowerCase(), type, key, value, blockNumber: rawEvent.meta.blockNumber });
                    }
                }

                else if (event?.name === 'DNSRecordDeleted') {
                    const log = event.args;
                    const type = 'dns'
                    const key = [Buffer.from(log.name.slice(2), 'hex').toString(), log.resource].join(' ')
                    spinner.text = `DNS Record deleted for: ${key}`;

                    // store the record setting
                    db.prepare('DELETE FROM records WHERE node = :node, resolverAddress = :resolverAddress, key = :key').run({ node: log.node, address: log.a, resolverAddress: rawEvent.address.toLowerCase(), type, key, blockNumber: rawEvent.meta.blockNumber });
                }

                else if (event?.name === 'DNSZonehashChanged') {
                    const log = event.args;
                    const type = 'zonehash'
                    const key = ''
                    const value = log.zonehash
                    spinner.text = `DNS Zone Hash changed for: ${log.node} ${value}`;

                    // store the record setting
                    db.prepare('INSERT OR REPLACE INTO records (node, resolverAddress, type, key, value, blockHeight) VALUES (:node, :resolverAddress, :type, :key, :value, :blockNumber)').run({ node: log.node, address: log.a, resolverAddress: rawEvent.address.toLowerCase(), type, key, value, blockNumber: rawEvent.meta.blockNumber });
                }
            }
            catch {/* ignore */ }
        }

        offset += 256
    } while (events.length > 0)

    spinner.succeed(chalk.green('Resolver records sync complete'));
}
