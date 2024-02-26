This project showcases how to index names, aiming to compile a complete list of primary names from vet.domains. It can be adopted for a custom indexer to be implemented into other projects.

- Initially, it indexes all resolver settings found in the registry.
- Then, it captures and indexes any changes to names or address records.
- When a change occurs to a resolver listed in the registry, the `nodes` table is updated with the new address or name.
- The system also offers a view that filters and displays the data.
- Each execution will incrementally update the dataset based on the findings from the previous successful execution.

Known issues:

- The system overlooks resolver records set before assigning a resolver in the registry. While unlikely, this could lead to potential issues.
- Indexed record events may originate from unused or invalid resolvers, potentially leading to database spam.

# Options

```shell
$ yarn start --help
            _        _                       _           
 __   _____| |_   __| | ___  _ __ ___   __ _(_)_ __  ___ 
 \ \ / / _ \ __| / _` |/ _ \| '_ ` _ \ / _` | | '_ \/ __|
  \ V /  __/ |_ | (_| | (_) | | | | | | (_| | | | | \__ \
   \_/ \___|\__(_)__,_|\___/|_| |_| |_|\__,_|_|_| |_|___/
                                                         
Usage: index [options]

vet.domains name indexer

Options:
  -V, --version             output the version number
  -n, --node <url>          Node URL of the blockchain (default: "https://node-mainnet.vechain.energy")
  -c, --contract <address>  Registry Address (default: "0xa9231da8BF8D10e2df3f6E03Dd5449caD600129b")
  -d, --database <file>     SQLite storage (default: "index.db")
  -h, --help                display help for command
```

**Example MainNet**

This will access `node-mainnet.vechain.energy` and fetch all names managed on `0xa9231da8BF8D10e2df3f6E03Dd5449caD600129b`. The result is stored in `index.db`.
```shell
yarn start --node https://node-mainnet.vechain.energy --contract 0xa9231da8BF8D10e2df3f6E03Dd5449caD600129b --database index.db
```

**Example TestNet**

```shell
yarn start --node https://node-testnet.vechain.energy --contract 0xcBFB30c1F267914816668d53AcBA7bA7c9806D13 --database testnet.db
```