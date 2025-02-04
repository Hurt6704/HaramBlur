// detector.js
// This module exports the human variable and the HUMAN_CONFIG object

import Human from "@vladmandic/human";
import { now } from "./helpers";
const modelsUrl = chrome.runtime.getURL("src/assets/models/human");
const nsfwUrl = chrome.runtime.getURL("src/assets/models/nsfwjs/model.json");
/**
 * @type {import("@vladmandic/human").Config}
 */
const HUMAN_CONFIG = {
	modelBasePath: modelsUrl,
	backend: "humangl",
	debug: false,
	cacheSensitivity: 0.9,
	warmup: "none",
	// filter: {
	// 	width: 224,
	// 	height: 224,
	// },
	face: {
		enabled: true,
		iris: { enabled: false },
		mesh: { enabled: false },
		emotion: { enabled: false },
		detector: {
			modelPath: "blazeface.json",
			maxDetected: 2,
		},
		description: {
			enabled: true,
			modelPath: "faceres.json",
		},
	},
	body: {
		enabled: false,
	},
	hand: {
		enabled: false,
	},
	gesture: {
		enabled: false,
	},
	object: {
		enabled: false,
	},
};

const NSFW_CONFIG = {
	size: 224,
	tfScalar: 255,
	topK: 3,
	skipTime: 4000,
	skipFrames: 99,
	cacheSensitivity: 0.9,
};

const getNsfwClasses = (factor = 0) => {
	// factor is a number between 0 and 1
	// it's used to increase the threshold for nsfw classes
	// the numbers are based on trial and error
	return {
		0: {
			className: "Drawing",
			nsfw: false,
			thresh: 0.5,
		},
		1: {
			className: "Hentai",
			nsfw: true,
			thresh: 0.3 + factor * 0.7, // highest it can go is 1
		},
		2: {
			className: "Neutral",
			nsfw: false,
			thresh: 0.8,
		},
		3: {
			className: "Porn",
			nsfw: true,
			thresh: 0.1 + factor * 0.35, // highest it can go is 0.4
		},
		4: {
			className: "Sexy",
			nsfw: true,
			thresh: 0.1 + factor * 0.35, // highest it can go is 0.4
		},
	};
};

let human;
let nsfwModel;
let nsfwCache = {
	predictions: [],
	timestamp: 0,
	skippedFrames: 0,
	lastInputTensor: null,
};

const initHuman = () => {
	human = new Human(HUMAN_CONFIG);
	return human.load();
};

const humanModelClassify = async (tensor, needToResize) =>
	new Promise((resolve, reject) => {
		const promise = needToResize
			? human.detect(tensor, {
					filter: {
						enabled: true,
						width: needToResize?.newWidth,
						height: needToResize?.newHeight,
						return: true,
					},
			  })
			: human.detect(tensor);
		promise
			.then((res) => {
				resolve(res);
			})
			.catch((err) => {
				reject(err);
			});
	});

const initNsfwModel = async () => {
	// load the model from indexedDB if it exists, otherwise load from url
	const indexedDBModel =
		typeof indexedDB !== "undefined" && (await human.tf.io.listModels());

	// if the model exists in indexedDB, load it from there
	if (indexedDBModel?.["indexeddb://nsfw-model"]) {
		nsfwModel = await human.tf.loadGraphModel("indexeddb://nsfw-model");
	}
	// otherwise load it from the url
	else {
		nsfwModel = await human.tf.loadGraphModel(nsfwUrl);
		// save the model to indexedDB
		await nsfwModel.save("indexeddb://nsfw-model");
	}
	// console.log("HB==NSFW MODEL", nsfwModel);
};

const nsfwModelSkip = async (input, config) => {
	const tf = human.tf;
	let skipFrame = false;
	if (
		config.cacheSensitivity === 0 ||
		!input?.shape ||
		input?.shape.length !== 4 ||
		input?.shape[1] > 3840 ||
		input?.shape[2] > 2160
	)
		return skipFrame; // cache disabled or input is invalid or too large for cache analysis

	if (!nsfwCache.lastInputTensor) {
		nsfwCache.lastInputTensor = tf.clone(input);
	} else if (
		nsfwCache.lastInputTensor.shape[1] !== input.shape[1] ||
		nsfwCache.lastInputTensor.shape[2] !== input.shape[2]
	) {
		// input resolution changed
		tf.dispose(nsfwCache.lastInputTensor);
		nsfwCache.lastInputTensor = tf.clone(input);
	} else {
		const t = {};
		t.diff = tf.sub(input, nsfwCache.lastInputTensor);
		t.squared = tf.mul(t.diff, t.diff);
		t.sum = tf.sum(t.squared);
		const diffSum = await t.sum.data();
		const diffRelative =
			diffSum[0] /
			(input.shape[1] || 1) /
			(input.shape[2] || 1) /
			255 /
			3; // squared difference relative to input resolution and averaged per channel
		tf.dispose([nsfwCache.lastInputTensor, t.diff, t.squared, t.sum]);
		nsfwCache.lastInputTensor = tf.clone(input);
		skipFrame = diffRelative <= (config.cacheSensitivity || 0);
	}
	return skipFrame;
};

const nsfwModelClassify = async (tensor, config = NSFW_CONFIG) => {
	const tf = human.tf;
	if (!tensor) return [];
	try {
		const skipAllowed = await nsfwModelSkip(tensor, config);
		const skipFrame = nsfwCache.skippedFrames < (config.skipFrames || 0);
		const skipTime = (config.skipTime || 0) > now() - nsfwCache.timestamp;

		// if skip is not allowed or skip time is not reached or skip frame is not reached or cache is empty then run the model
		if (
			!skipAllowed ||
			!skipTime ||
			!skipFrame ||
			nsfwCache.predictions.length === 0
		) {
			const resized = tf.image.resizeBilinear(tensor, [
				config.size,
				config.size,
			]);
			const normalized = tf.div(resized, tf.scalar(config.tfScalar));
			const logits = await nsfwModel.predict(normalized);

			nsfwCache.predictions = await getTopKClasses(logits, config.topK);
			nsfwCache.timestamp = now();
			nsfwCache.skippedFrames = 0;

			tf.dispose([resized, normalized, logits]);
		} else {
			nsfwCache.skippedFrames++;
		}

		return nsfwCache.predictions;
	} catch (error) {
		console.error("HB==NSFW Detection Error", error);
	}
};

async function getTopKClasses(logits, topK) {
	const values = await logits.data();

	const valuesAndIndices = [];
	for (let i = 0; i < values.length; i++) {
		valuesAndIndices.push({ value: values[i], index: i });
	}
	valuesAndIndices.sort((a, b) => {
		return b.value - a.value;
	});
	const topkValues = new Float32Array(topK);
	const topkIndices = new Int32Array(topK);
	for (let i = 0; i < topK; i++) {
		topkValues[i] = valuesAndIndices[i].value;
		topkIndices[i] = valuesAndIndices[i].index;
	}

	const topClassesAndProbs = [];
	for (let i = 0; i < topkIndices.length; i++) {
		topClassesAndProbs.push({
			className: getNsfwClasses()?.[topkIndices[i]].className,
			probability: topkValues[i],
			id: topkIndices[i],
		});
	}
	return topClassesAndProbs;
}
// export the human variable and the HUMAN_CONFIG object
export {
	initHuman,
	initNsfwModel,
	nsfwModel,
	human,
	HUMAN_CONFIG,
	nsfwModelClassify,
	getNsfwClasses,
	humanModelClassify,
};
