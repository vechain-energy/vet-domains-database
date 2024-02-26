type EventLog = (Connex.VM.Event & { meta: { blockID: string, blockNumber: number, blockTimestamp: number } })


type Options = {
    node: string
    contract: string
    database: string
}
