const assert = require('assert');
const fs = require('fs');
const os = require('os');

import YTDlpWrap, { YTDlpEventEmitter, YTDlpReadable } from '../src';
const ytDlpWrap = new YTDlpWrap();

const testVideoPath = 'test/testVideo.mp4';
const testVideoId = 'C0DPdy98e4c';
const testVideoURL = 'https://www.youtube.com/watch?v=' + testVideoId;

const isValidVersion = (version: string) =>
    !isNaN(Date.parse(version.substring(0, 10).replace(/\./g, '-')));

const checkFileDownload = function () {
    let fileName = os.platform() == 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    assert(fs.existsSync('./' + fileName));
    const stats = fs.statSync('./' + fileName);
    fs.unlinkSync('./' + fileName);
    assert(stats.size > 0);
};

const checkEventEmitter = function (
    ytDlpEventEmitter: YTDlpEventEmitter | YTDlpReadable
) {
    return new Promise((resolve, reject) => {
        let progressDefined = false;
        ytDlpEventEmitter.on('progress', (progressObject) => {
            if (
                progressObject.percent != undefined ||
                progressObject.totalSize != undefined ||
                progressObject.currentSpeed != undefined ||
                progressObject.eta != undefined
            )
                progressDefined = true;
        });

        let ytDlpEventFound = false;
        ytDlpEventEmitter.on('ytDlpEvent', (eventType, eventData) => {
            if (eventType == 'youtube' && eventData.includes(testVideoId))
                ytDlpEventFound = true;
        });

        ytDlpEventEmitter.on('error', (error) => reject(error));
        ytDlpEventEmitter.on('close', () => {
            assert(fs.existsSync(testVideoPath));
            const stats = fs.statSync(testVideoPath);
            fs.unlinkSync(testVideoPath);
            assert.strictEqual(stats.size, 171516);
            assert(progressDefined);
            assert(ytDlpEventFound);
            resolve(undefined);
        });
    });
};

describe('downloading yt-dlp binary', function () {
    it('should download from github', async function () {
        await YTDlpWrap.downloadFromGithub();
        checkFileDownload();
    });
});

describe('download video functions', function () {
    it('should download a video via EventEmitter', async function () {
        let ytDlpEventEmitter = ytDlpWrap.exec([
            testVideoURL,
            '-f',
            'worst',
            '-o',
            'test/testVideo.mp4',
        ]);
        await checkEventEmitter(ytDlpEventEmitter);
    });

    it('should download a video via Readable Stream', async function () {
        let readableStream = ytDlpWrap.execStream([
            testVideoURL,
            '-f',
            'worst',
        ]);
        readableStream.pipe(fs.createWriteStream(testVideoPath));
        await checkEventEmitter(readableStream);
    });
});

describe('AbortController functions', function () {
    it('abort the EventEmitter process', async function () {
        let controller = new AbortController();
        let ytDlpEventEmitter = ytDlpWrap.exec(
            [testVideoURL, '-f', 'worst', '-o', 'test/testVideo.mp4'],
            {},
            controller.signal
        );
        controller.abort();
        assert(ytDlpEventEmitter.ytDlpProcess?.killed);
    });

    it('abort the Readable Stream process', async function () {
        let controller = new AbortController();
        let readableStream = ytDlpWrap.execStream(
            [testVideoURL, '-f', 'worst', '-o', 'test/testVideo.mp4'],
            {},
            controller.signal
        );
        controller.abort();
        assert(readableStream.ytDlpProcess?.killed);
    });

    it('abort the Promise process', async function () {
        let controller = new AbortController();
        let execPromise = ytDlpWrap.execPromise(
            [testVideoURL, '-f', 'worst', '-o', 'test/testVideo.mp4'],
            {},
            controller.signal
        );
        controller.abort();
        assert(execPromise.ytDlpProcess?.killed);
    });
});

describe('utility functions', function () {
    it('video Info should have title Big Buck Bunny 60fps 4K - Official Blender Foundation Short Film', async function () {
        let videoInfo = await ytDlpWrap.getVideoInfo(
            'https://www.youtube.com/watch?v=aqz-KE-bpKQ'
        );
        assert.strictEqual(
            videoInfo.title,
            'Big Buck Bunny 60fps 4K - Official Blender Foundation Short Film'
        );
    });

    it('version should start with a date', async function () {
        let versionString = await ytDlpWrap.getVersion();
        assert(isValidVersion(versionString));
    });

    it('user agent should be a string with at least 10 characters', async function () {
        let userAgentString = await ytDlpWrap.getUserAgent();
        assert.strictEqual(typeof userAgentString, 'string');
        assert(userAgentString.length >= 10);
    });

    it('help should include explanation for version setting', async function () {
        let helpString = await ytDlpWrap.getHelp();
        assert.strictEqual(typeof helpString, 'string');
        assert(helpString.includes('--version'));
    });

    it('extractor list should include youtube', async function () {
        let extractorList = await ytDlpWrap.getExtractors();
        assert(Array.isArray(extractorList));
        assert(extractorList.includes('youtube'));
    });

    it('extractor description list should include YouTube.com playlists', async function () {
        let extractorList = await ytDlpWrap.getExtractorDescriptions();
        assert(Array.isArray(extractorList));
        assert(extractorList.includes('YouTube playlists'));
    });
});
