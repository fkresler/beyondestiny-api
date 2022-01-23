import {
  DestinyInventoryBucketDefinition,
  DestinyInventoryItemDefinition,
  DestinyManifest,
  DestinyStatDefinition,
  getDestinyManifest,
  getDestinyManifestSlice,
} from 'bungie-api-ts/destiny2';
import { HttpClientGenerator } from './client';

const clientGenerator = new HttpClientGenerator();

type DestinyBucketDefinition = {
  [key: string]: DestinyInventoryBucketDefinition;
};

type DestinyInventoryDefinition = {
  [key: string]: DestinyInventoryItemDefinition;
};

type DestinyStatCollection = {
  [key: string]: DestinyStatDefinition;
};

export class WeaponManager {
  httpClient: ReturnType<typeof clientGenerator.getClient>;

  destinyManifest: Promise<DestinyManifest>;

  destinyDefinitions: ReturnType<typeof this.initializeDefinitionData>;

  weaponDefinitions: Promise<DestinyInventoryDefinition>;

  constructor() {
    this.httpClient = clientGenerator.getClient();

    this.destinyManifest = this.initializeManifest();
    this.destinyDefinitions = this.initializeDefinitionData();
    this.weaponDefinitions = this.initializeWeaponData();

    this.initializeWeaponData();
  }

  private initializeManifest = async () => {
    try {
      const manifestResponse = await getDestinyManifest(this.httpClient);
      return manifestResponse.Response;
    } catch (e) {
      console.error('initializeManifest: initializing the Destiny manifest failed', e);
      throw e;
    }
  };

  private initializeDefinitionData = async () => {
    try {
      const manifest = await this.destinyManifest;
      /**
       * DestinyInventoryItemDefinition:
       * -> definition including perks and relationships
       * -> starting point for a weapon definition
       * DestinyInventoryBucketDefinition:
       * -> for weapons you will find the slot classification here, e.g. kinetic, energy or heavy
       * -> weapon JSON -> inventory -> bucketTypeHash
       * DestinyItemTierTypeDefinition:
       * -> for weapons you will find the definitions of the rarity here, e.g. legendary or exotic
       * -> weapon JSON -> inventory -> tierTypeHash
       * DestinyStatDefinition:
       * -> for weapons you will find the definitions of the stats here, e.g. stability, reload, zoom
       * -> weapon JSON -> stats -> stats ODER weapon JSON -> investmentStats
       * DestinyDamageTypeDefinition:
       * -> for weapons you will find the definitions of the damage type here, e.g. void, arc, solar
       * -> weapon JSON -> damageTypeHashes
       * DestinyItemCategoryDefinition:
       * -> for weapons you will find the weapon archetypes here, e.g. Fusion Rifle
       * -> weapon JSON -> itemCategoryHashes
       * DestinyPlugSetDefinition:
       * -> for weapons you will find each collection of random rolls of a slot here
       * -> each perk is defined inside DestinyInventoryItemDefinition
       * -> weapon JSON -> sockets -> socketEntries -> reusablePlugSetHash
       * DestinySocketTypeDefinition:
       * -> for weapons you will find each socket type here, e.g. intrinsic, weapon perks, cosmetics
       * -> weapon JSON -> sockets -> socketEntries -> socketTypeHash
       * DestinySocketCategoryDefinition:
       * -> for weapons you will find the definition of each above socket type here
       * -> weapon JSON -> sockets -> socketEntries -> socketTypeHash
       */
      return await getDestinyManifestSlice(this.httpClient, {
        destinyManifest: manifest,
        language: 'en',
        tableNames: [
          'DestinyInventoryItemDefinition',
          'DestinyInventoryBucketDefinition',
          'DestinyStatDefinition',
          'DestinySeasonDefinition',
        ],
      });
    } catch (e) {
      console.error('initializeDefinitionData: initializing definition data failed', e);
      throw e;
    }
  };

  private initializeWeaponData = async () => {
    // identifiers by which weapons are identified among all inventory items
    const kineticBucketName = 'Kinetic Weapons';
    const energyBucketName = 'Energy Weapons';
    const powerBucketName = 'Power Weapons';

    let bucketDefinitions: DestinyBucketDefinition;
    let inventoryDefinitions: DestinyInventoryDefinition;

    try {
      const destinyDefinitions = await this.destinyDefinitions;
      bucketDefinitions = destinyDefinitions.DestinyInventoryBucketDefinition;
      inventoryDefinitions = destinyDefinitions.DestinyInventoryItemDefinition;
    } catch (e) {
      console.error('initializeWeaponData: getting the definition and bucket data failed', e);
      throw e;
    }

    const kineticBucketKey = Object.keys(bucketDefinitions).filter(
      (key) => bucketDefinitions[key].displayProperties.name === kineticBucketName,
    )[0];
    const energyBucketKey = Object.keys(bucketDefinitions).filter(
      (key) => bucketDefinitions[key].displayProperties.name === energyBucketName,
    )[0];
    const powerBucketKey = Object.keys(bucketDefinitions).filter(
      (key) => bucketDefinitions[key].displayProperties.name === powerBucketName,
    )[0];

    if (!kineticBucketKey) {
      const errorDesc = 'initializeWeaponData: failed getting the kinetic bucket key';
      console.error(errorDesc);
      throw new Error(errorDesc);
    }

    if (!energyBucketKey) {
      const errorDesc = 'initalizeWeaponData: failed getting the energy bucket key';
      console.error(errorDesc);
      throw new Error(errorDesc);
    }

    if (!powerBucketKey) {
      const errorDesc = 'initializeWeaponData: failed getting the power bucket key';
      console.error(errorDesc);
      throw new Error(errorDesc);
    }

    const filteredWeaponCollection: DestinyInventoryDefinition = Object.keys(inventoryDefinitions)
      .filter((key) => {
        const inventoryItem = inventoryDefinitions[key];
        const currentBucket = inventoryItem.inventory.bucketTypeHash.toString();
        return (
          currentBucket === kineticBucketKey ||
          currentBucket === energyBucketKey ||
          currentBucket === powerBucketKey
        );
      })
      .reduce(
        (previous, weaponKey) => ({
          ...previous,
          [weaponKey]: { ...inventoryDefinitions[weaponKey] },
        }),
        {},
      );
    return filteredWeaponCollection;
  };

  private formatWeaponDefinition = async (definition: DestinyInventoryItemDefinition) => {
    const { bucketTypeHash, tierTypeHash } = definition.inventory;

    const { damageTypeHashes, itemCategoryHashes, seasonHash } = definition;

    const weaponStats = await this.resolveWeaponStats(definition);

    const weaponSockets = await this.resolveWeaponSockets(definition);

    return {
      name: definition.displayProperties.name,
      seasonHash,
      bucketTypeHash,
      tierTypeHash,
      damageTypeHashes,
      itemCategoryHashes,
      stats: [...weaponStats],
      sockets: { ...weaponSockets },
    };
  };

  private resolveWeaponStats = async (definition: DestinyInventoryItemDefinition) => {
    const { stats } = definition.stats;

    let statDefinitions: DestinyStatCollection;
    let impactStatKey: string;
    let rangeStatKey: string;
    let stabilityStatKey: string;
    let handlingStatKey: string;
    let reloadSpeedStatKey: string;
    let rpmStatKey: string;
    let magazineStatKey: string;
    let aimAssistanceStatKey: string;
    let inventorySizeStatKey: string;
    let zoomStatKey: string;
    let recoilStatKey: string;

    try {
      const destinyDefinitions = await this.destinyDefinitions;
      statDefinitions = destinyDefinitions.DestinyStatDefinition;

      [impactStatKey] = Object.keys(statDefinitions).filter(
        (key) => statDefinitions[key].displayProperties.name === 'Impact',
      );
      [rangeStatKey] = Object.keys(statDefinitions).filter(
        (key) => statDefinitions[key].displayProperties.name === 'Range',
      );
      [stabilityStatKey] = Object.keys(statDefinitions).filter(
        (key) => statDefinitions[key].displayProperties.name === 'Stability',
      );
      [handlingStatKey] = Object.keys(statDefinitions).filter(
        (key) => statDefinitions[key].displayProperties.name === 'Handling',
      );
      [reloadSpeedStatKey] = Object.keys(statDefinitions).filter(
        (key) => statDefinitions[key].displayProperties.name === 'Reload Speed',
      );
      [rpmStatKey] = Object.keys(statDefinitions).filter(
        (key) => statDefinitions[key].displayProperties.name === 'Rounds Per Minute',
      );
      [magazineStatKey] = Object.keys(statDefinitions).filter(
        (key) => statDefinitions[key].displayProperties.name === 'Magazine',
      );
      [aimAssistanceStatKey] = Object.keys(statDefinitions).filter(
        (key) => statDefinitions[key].displayProperties.name === 'Aim Assistance',
      );
      [inventorySizeStatKey] = Object.keys(statDefinitions).filter(
        (key) => statDefinitions[key].displayProperties.name === 'Inventory Size',
      );
      [zoomStatKey] = Object.keys(statDefinitions).filter(
        (key) => statDefinitions[key].displayProperties.name === 'Zoom',
      );
      [recoilStatKey] = Object.keys(statDefinitions).filter(
        (key) => statDefinitions[key].displayProperties.name === 'Recoil',
      );
    } catch (e) {
      console.error('formatWeaponStats: getting the stat definitions failed', e);
    }

    return [
      {
        id: 0,
        statHash: impactStatKey,
        name: statDefinitions[impactStatKey].displayProperties.name,
        description: statDefinitions[impactStatKey].displayProperties.description,
        value: stats[parseInt(impactStatKey, 10)].value,
      },
      {
        id: 1,
        statHash: rangeStatKey,
        name: statDefinitions[rangeStatKey].displayProperties.name,
        description: statDefinitions[rangeStatKey].displayProperties.description,
        value: stats[parseInt(rangeStatKey, 10)].value,
      },
      {
        id: 2,
        statHash: stabilityStatKey,
        name: statDefinitions[stabilityStatKey].displayProperties.name,
        description: statDefinitions[stabilityStatKey].displayProperties.description,
        value: stats[parseInt(stabilityStatKey, 10)].value,
      },
      {
        id: 3,
        statHash: handlingStatKey,
        name: statDefinitions[handlingStatKey].displayProperties.name,
        description: statDefinitions[handlingStatKey].displayProperties.description,
        value: stats[parseInt(handlingStatKey, 10)].value,
      },
      {
        id: 4,
        statHash: reloadSpeedStatKey,
        name: statDefinitions[reloadSpeedStatKey].displayProperties.name,
        description: statDefinitions[reloadSpeedStatKey].displayProperties.description,
        value: stats[parseInt(reloadSpeedStatKey, 10)].value,
      },
      {
        id: 5,
        statHash: rpmStatKey,
        name: statDefinitions[rpmStatKey].displayProperties.name,
        description: statDefinitions[rpmStatKey].displayProperties.description,
        value: stats[parseInt(rpmStatKey, 10)].value,
      },
      {
        id: 6,
        statHash: magazineStatKey,
        name: statDefinitions[magazineStatKey].displayProperties.name,
        description: statDefinitions[magazineStatKey].displayProperties.description,
        value: stats[parseInt(magazineStatKey, 10)].value,
      },
      {
        id: 7,
        statHash: aimAssistanceStatKey,
        name: statDefinitions[aimAssistanceStatKey].displayProperties.name,
        description: statDefinitions[aimAssistanceStatKey].displayProperties.description,
        value: stats[parseInt(aimAssistanceStatKey, 10)].value,
      },
      {
        id: 8,
        statHash: inventorySizeStatKey,
        name: statDefinitions[inventorySizeStatKey].displayProperties.name,
        description: statDefinitions[inventorySizeStatKey].displayProperties.description,
        value: stats[parseInt(inventorySizeStatKey, 10)].value,
      },
      {
        id: 9,
        statHash: zoomStatKey,
        name: statDefinitions[zoomStatKey].displayProperties.name,
        description: statDefinitions[zoomStatKey].displayProperties.description,
        value: stats[parseInt(zoomStatKey, 10)].value,
      },
      {
        id: 10,
        statHash: recoilStatKey,
        name: statDefinitions[recoilStatKey].displayProperties.name,
        description: statDefinitions[recoilStatKey].displayProperties.description,
        value: stats[parseInt(recoilStatKey, 10)].value,
      },
    ];
  };

  private resolveWeaponSockets = async (definition: DestinyInventoryItemDefinition) => ({});

  public getWeaponDefinitions = async () => this.weaponDefinitions;
}

export default WeaponManager;
