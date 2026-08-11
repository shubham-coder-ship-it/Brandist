import { createServerFn } from "@tanstack/react-start";
import {
    ExtractKitInputSchema,
    GenerateSampleCopyInputSchema,
    HarvestMoreAssetsInputSchema,
    extractKitImpl,
    generateSampleCopyImpl,
    harvestMoreAssetsImpl,
} from "@/server/extraction.server";

export const extractKit = createServerFn({ method: "POST" })
    .inputValidator((data) => ExtractKitInputSchema.parse(data))
    .handler(async ({ data }) => extractKitImpl(data));

export const generateSampleCopy = createServerFn({ method: "POST" })
    .inputValidator((data) => GenerateSampleCopyInputSchema.parse(data))
    .handler(async ({ data }) => generateSampleCopyImpl(data));

export const harvestMoreAssets = createServerFn({ method: "POST" })
    .inputValidator((data) => HarvestMoreAssetsInputSchema.parse(data))
    .handler(async ({ data }) => harvestMoreAssetsImpl(data));
