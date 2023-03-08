import { SaveType } from "@actor/types";
import { BaseItemDataPF2e, BaseItemSourcePF2e, ItemSystemData, ItemSystemSource } from "@item/data/base";
import { OneToTen, TraitsWithRarity, ValueAndMax } from "@module/data";
import { MaterialDamageEffect, DamageCategoryUnique, DamageType } from "@system/damage";
import type { SpellPF2e } from "./document";
import { EffectAreaSize, EffectAreaType, MagicSchool, MagicTradition, SpellComponent, SpellTrait } from "./types";

type SpellSource = BaseItemSourcePF2e<"spell", SpellSystemSource>;

interface SpellData
    extends Omit<SpellSource, "flags" | "system" | "type">,
        BaseItemDataPF2e<SpellPF2e, "spell", SpellSource> {}

interface SpellSystemSource extends ItemSystemSource {
    traits: SpellTraits;
    level: { value: OneToTen };
    spellType: {
        value: keyof ConfigPF2e["PF2E"]["spellTypes"];
    };
    category: {
        value: keyof ConfigPF2e["PF2E"]["spellCategories"];
    };
    traditions: { value: MagicTradition[] };
    school: { value: MagicSchool };
    components: Record<SpellComponent, boolean>;
    materials: {
        value: string;
    };
    target: {
        value: string;
    };
    range: {
        value: string;
    };
    area: {
        value: EffectAreaSize;
        type: EffectAreaType;
        /**
         * Legacy text information about spell effect areas:
         * if present, includes information not representable in a structured way
         */
        details?: string;
    } | null;
    time: {
        value: string;
    };
    duration: {
        value: string;
    };
    damage: {
        value: Record<string, SpellDamage>;
    };
    heightening?: SpellHeighteningFixed | SpellHeighteningInterval;
    overlays?: Record<string, SpellOverlay>;
    save: {
        basic: string;
        value: SaveType | "";
        dc?: number;
        str?: string;
    };
    sustained: {
        value: false;
    };
    cost: {
        value: string;
    };
    hasCounteractCheck: {
        value: boolean;
    };
    location: {
        value: string | null;
        signature?: boolean;
        heightenedLevel?: number;

        /** The level to heighten this spell to if it's a cantrip or focus spell */
        autoHeightenLevel?: OneToTen | null;

        /** Number of uses if this is an innate spell */
        uses?: ValueAndMax;
    };
}

interface SpellSystemData extends SpellSystemSource, Omit<ItemSystemData, "level" | "traits"> {}

export type SpellTraits = TraitsWithRarity<SpellTrait>;

export interface SpellDamageType {
    value: DamageType;
    subtype?: DamageCategoryUnique;
    categories: MaterialDamageEffect[];
}

export interface SpellDamage {
    value: string;
    applyMod?: boolean;
    type: SpellDamageType;
}

export interface SpellHeighteningInterval {
    type: "interval";
    interval: number;
    damage: Record<string, string>;
}

export interface SpellHeighteningFixed {
    type: "fixed";
    levels: Record<OneToTen, Partial<SpellSystemSource>>;
}

export interface SpellHeightenLayer {
    level: number;
    system: Partial<SpellSystemData>;
}

interface SpellOverlayOverride {
    _id: string;
    system: Partial<SpellSystemSource>;
    name?: string;
    overlayType: "override";
    sort: number;
}

/** Not implemented */
interface SpellOverlayDamage {
    overlayType: "damage";
    choices: DamageType[];
}

type SpellOverlay = SpellOverlayOverride | SpellOverlayDamage;
type SpellOverlayType = SpellOverlay["overlayType"];

export {
    SpellData,
    SpellSource,
    SpellSystemData,
    SpellSystemSource,
    SpellOverlay,
    SpellOverlayOverride,
    SpellOverlayType,
};
