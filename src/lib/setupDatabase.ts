import Database from "better-sqlite3"

export async function setupDatabase(database: string) {
    const db = new Database(database);
    db.pragma('journal_mode = WAL');
    db.prepare('CREATE TABLE IF NOT EXISTS nodeResolvers (node TEXT PRIMARY KEY, resolverAddress TEXT, blockHeight INTEGER)').run();
    db.prepare('CREATE TABLE IF NOT EXISTS nodeAddresses (resolverAddress TEXT, node TEXT, address TEXT, blockHeight INTEGER, PRIMARY KEY (resolverAddress, node))').run();
    db.prepare('CREATE TABLE IF NOT EXISTS nodeNames (resolverAddress TEXT, node TEXT, name TEXT, blockHeight INTEGER, PRIMARY KEY (resolverAddress, node))').run();
    db.prepare('CREATE TABLE IF NOT EXISTS nodes (node TEXT PRIMARY KEY, reverseNode TEXT, resolverAddress TEXT, address TEXT, name TEXT, blockHeight INTEGER)').run();
    db.prepare(`CREATE VIEW IF NOT EXISTS primaryNames AS 
        SELECT n.address, MAX(nr.name) as name, MAX(n.blockHeight) as blockHeight 
            FROM nodes n 
                LEFT JOIN nodes nr 
                    ON nr.node = n.reverseNode 
            WHERE 
                n.address IS NOT NULL 
                AND n.address NOT NULL 
            GROUP BY n.address 
            ORDER by blockHeight DESC
    `).run();

    return db
}