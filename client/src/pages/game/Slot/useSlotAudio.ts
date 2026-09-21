/* eslint-disable */

import { useCallback, useEffect, useRef, useState } from "react";

import bigwin from "/bigwin.mp3";
import slotBackground from "/sounds/slotbackground.mp3";
import slotSpin from "/sounds/slotspin.mp3";
import slotWin from "/sounds/slotwin.mp3";
import clickSound from "/sounds/click.mp3";

/**
 * Volume levels for each track, centralized so tuning the mix
 * doesn't require hunting through component logic.
 */
const VOLUMES = {
    background: 0.3,
    spin: 0.5,
    win: 0.6,
    click: 0.4,
    bigWin: 0.05,
} as const;

interface AudioTrackMap {
    background: HTMLAudioElement;
    spin: HTMLAudioElement;
    win: HTMLAudioElement;
    click: HTMLAudioElement;
    bigWin: HTMLAudioElement;
}

type TrackName = keyof AudioTrackMap;

/**
 * Owns creation, playback, and teardown of every sound effect used
 * by the slot machine. Consumers get a small, intention-revealing
 * API (`play`, `stopSpin`, `toggleSound`) instead of juggling raw
 * <audio> refs themselves.
 */
export const useSlotAudio = () => {
    const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

    const tracksRef = useRef<AudioTrackMap | null>(null);

    useEffect(() => {
        const tracks: AudioTrackMap = {
            background: new Audio(slotBackground),
            spin: new Audio(slotSpin),
            win: new Audio(slotWin),
            click: new Audio(clickSound),
            bigWin: new Audio(bigwin),
        };

        tracks.background.loop = true;

        (Object.keys(tracks) as TrackName[]).forEach((name) => {
            tracks[name].volume = VOLUMES[name];
        });

        tracks.background.play().catch(() => {
            // Autoplay is commonly blocked until the user interacts.
        });

        tracksRef.current = tracks;

        return () => {
            (Object.keys(tracks) as TrackName[]).forEach((name) => {
                const audio = tracks[name];

                audio.pause();
                audio.src = "";
            });

            tracksRef.current = null;
        };
    }, []);

    const play = useCallback(
        (name: TrackName): void => {
            if (!soundEnabled) {
                return;
            }

            const audio = tracksRef.current?.[name];

            if (!audio) {
                return;
            }

            audio.currentTime = 0;
            audio.play().catch(() => {
                // Playback can be rejected; failing silently is fine here.
            });
        },
        [soundEnabled]
    );

    const stop = useCallback((name: TrackName): void => {
        const audio = tracksRef.current?.[name];

        if (!audio) {
            return;
        }

        audio.pause();
        audio.currentTime = 0;
    }, []);

    const toggleSound = useCallback((): void => {
        setSoundEnabled((previous) => {
            const next = !previous;
            const tracks = tracksRef.current;

            if (!tracks) {
                return next;
            }

            if (next) {
                tracks.background.play().catch(() => {});
            } else {
                tracks.background.pause();
                tracks.spin.pause();
                tracks.spin.currentTime = 0;
            }

            return next;
        });
    }, []);

    return { soundEnabled, play, stop, toggleSound };
};