import { Duration, Instant } from "@js-joda/core";

interface Connection {
    meetingCode: string;
    memberId: string;
    lastActive: Instant;
}

export interface ConnectionRepository {
    add: (connection: Connection) => Promise<void>;
    fetchInactive: (interval: Duration) => Promise<Array<Connection>>;
}

export async function createConnectionRepository(): Promise<ConnectionRepository> {
    const connections = new Map<string, Connection>();

    return {
        add: async (connection: Connection) => {
            connections.set(connection.meetingCode + "__" + connection.memberId, connection);
        },
        fetchInactive: async (interval: Duration) => {
            const now = Instant.now();
            const minLastActive = now.minus(interval);
            return Array.from(connections.values())
                .filter(connection => connection.lastActive.compareTo(minLastActive) < 0);
        },
    };
}
