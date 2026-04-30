#!/usr/bin/env tsx
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';

const COLLECTION = 'place.stream.chat.message';
const JETSTREAM_URL = 'wss://jetstream2.us-east.bsky.network/subscribe';

const streamerDid = process.argv[2];
const outFile = resolve(process.argv[3] ?? 'chat.txt');

if (!streamerDid || !streamerDid.startsWith('did:')) {
	console.error('usage: tsx scripts/listen-chat.ts <streamer-did> [out-file]');
	process.exit(1);
}

const url = `${JETSTREAM_URL}?wantedCollections=${encodeURIComponent(COLLECTION)}`;

type JetstreamEvent = {
	did: string;
	time_us: number;
	kind: 'commit' | 'identity' | 'account';
	commit?: {
		rev: string;
		operation: 'create' | 'update' | 'delete';
		collection: string;
		rkey: string;
		record?: {
			$type: string;
			text: string;
			streamer: string;
			createdAt: string;
		};
		cid?: string;
	};
};

function connect() {
	console.error(`[listen-chat] connecting, filtering streamer=${streamerDid}`);
	const ws = new WebSocket(url);

	ws.addEventListener('open', () => console.error('[listen-chat] connected'));

	ws.addEventListener('message', (ev) => {
		let msg: JetstreamEvent;
		try {
			msg = JSON.parse(ev.data as string);
		} catch {
			return;
		}
		const c = msg.commit;
		if (!c || c.operation !== 'create' || c.collection !== COLLECTION) return;
		const rec = c.record;
		if (!rec || rec.streamer !== streamerDid) return;

		const line = `${msg.did}: ${rec.text}`;
		appendFileSync(outFile, line + '\n');
		console.log(line);
	});

	ws.addEventListener('close', (ev) => {
		console.error(`[listen-chat] closed (${ev.code}); reconnecting in 2s`);
		setTimeout(connect, 2000);
	});

	ws.addEventListener('error', (ev) => {
		console.error('[listen-chat] error', ev);
	});
}

connect();
