/**
 * #1157: the daemon's `registry-mirrors` arrive from GET /info as full URLs with a trailing
 * slash, and Dockhand compares registry hosts as bare `host[:port]`. These are the pure
 * normaliser and the "does this daemon mirror Docker Hub" predicate.
 */
import { describe, test, expect } from 'bun:test';
import { mirrorsFromDaemonInfo, daemonHasRegistryMirrors } from '../src/lib/server/registry/daemon-mirrors';

describe('mirrorsFromDaemonInfo', () => {
	test('strips scheme and trailing slash', () => {
		expect(mirrorsFromDaemonInfo({ RegistryConfig: { Mirrors: ['https://docker.example.com/'] } }))
			.toEqual(['docker.example.com']);
	});

	test('keeps a non-default port', () => {
		expect(mirrorsFromDaemonInfo({ RegistryConfig: { Mirrors: ['http://mirror.lan:5000/'] } }))
			.toEqual(['mirror.lan:5000']);
	});

	test('accepts a bare host without a scheme', () => {
		expect(mirrorsFromDaemonInfo({ RegistryConfig: { Mirrors: ['mirror.lan'] } }))
			.toEqual(['mirror.lan']);
	});

	test('collapses duplicates that differ only in case or scheme', () => {
		expect(mirrorsFromDaemonInfo({
			RegistryConfig: { Mirrors: ['https://A.Example/', 'http://a.example', 'https://a.example/'] }
		})).toEqual(['a.example']);
	});

	test('drops unusable entries', () => {
		expect(mirrorsFromDaemonInfo({
			RegistryConfig: { Mirrors: [null, '', '   ', {}, 'https://', 'not a url'] }
		})).toEqual([]);
	});

	test('returns [] for an unexpected or missing shape', () => {
		expect(mirrorsFromDaemonInfo(undefined)).toEqual([]);
		expect(mirrorsFromDaemonInfo(null)).toEqual([]);
		expect(mirrorsFromDaemonInfo({})).toEqual([]);
		expect(mirrorsFromDaemonInfo({ RegistryConfig: {} })).toEqual([]);
		expect(mirrorsFromDaemonInfo({ RegistryConfig: { Mirrors: null } })).toEqual([]);
		expect(mirrorsFromDaemonInfo({ RegistryConfig: { Mirrors: 'https://nope/' } })).toEqual([]);
	});

	test('keeps the daemon order', () => {
		expect(mirrorsFromDaemonInfo({
			RegistryConfig: { Mirrors: ['https://first.test/', 'https://second.test/'] }
		})).toEqual(['first.test', 'second.test']);
	});
});

describe('daemonHasRegistryMirrors', () => {
	test('true when the daemon reports a usable mirror', () => {
		expect(daemonHasRegistryMirrors({ RegistryConfig: { Mirrors: ['https://docker.1ms.run/'] } })).toBe(true);
	});

	test('false when it reports none or the info call shape is wrong', () => {
		expect(daemonHasRegistryMirrors({ RegistryConfig: { Mirrors: [] } })).toBe(false);
		expect(daemonHasRegistryMirrors({ RegistryConfig: {} })).toBe(false);
		expect(daemonHasRegistryMirrors(undefined)).toBe(false);
	});
});
