import * as fs from 'fs';
import Koa from 'koa';
import {
  DestinyInventoryBucketDefinition,
  DestinyInventoryItemDefinition,
  DestinyManifest,
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

export class WeaponManager {
  httpClient: ReturnType<typeof clientGenerator.getClient>;

  destinyManifest: DestinyManifest;

  inventoryDefinitions: DestinyInventoryDefinition;

  bucketDefinitions: DestinyBucketDefinition;

  weaponDefinitions: DestinyInventoryDefinition;

  constructor() {
    this.httpClient = clientGenerator.getClient();

    this.initializeWeaponData();
  }

  private initializeWeaponData = async () => {
    try {
      const manifestResponse = await getDestinyManifest(this.httpClient);
      this.destinyManifest = manifestResponse.Response;
      const result = await getDestinyManifestSlice(this.httpClient, {
        destinyManifest: manifestResponse.Response,
        language: 'en',
        tableNames: ['DestinyInventoryItemDefinition', 'DestinyInventoryBucketDefinition'],
      });
      this.inventoryDefinitions = result.DestinyInventoryItemDefinition;
      this.bucketDefinitions = result.DestinyInventoryBucketDefinition;
    } catch (e) {
      console.error('Initializing weapon data was not successful', e);
    }
    try {
      await this.filterWeaponDefinitions();
    } catch (e) {
      console.error('Filtering weapon data was not successful', e);
    }
  };

  private filterWeaponDefinitions = async () => {
    // identifiers by which weapons are identified among all inventory items
    const kineticBucketName = 'Kinetic Weapons';
    const energyBucketName = 'Energy Weapons';
    const powerBucketName = 'Power Weapons';

    const kineticBucketKey = Object.keys(this.bucketDefinitions).filter(
      (key) => this.bucketDefinitions[key].displayProperties.name === kineticBucketName,
    )[0];
    const energyBucketKey = Object.keys(this.bucketDefinitions).filter(
      (key) => this.bucketDefinitions[key].displayProperties.name === energyBucketName,
    )[0];
    const powerBucketKey = Object.keys(this.bucketDefinitions).filter(
      (key) => this.bucketDefinitions[key].displayProperties.name === powerBucketName,
    )[0];

    const filteredWeaponCollection: DestinyInventoryDefinition = Object.keys(
      this.inventoryDefinitions,
    )
      .filter((key) => {
        const inventoryItem = this.inventoryDefinitions[key];
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
          [weaponKey]: { ...this.inventoryDefinitions[weaponKey] },
        }),
        {},
      );
    this.weaponDefinitions = filteredWeaponCollection;
  };
}

export const weaponApi = async (ctx: Koa.Context) => {
  let bucketDefinitions: DestinyBucketDefinition;
  let inventoryDefinitions: DestinyInventoryDefinition;
  const weaponDefinitions: DestinyInventoryItemDefinition[] = [];
  try {
    const httpClient = clientGenerator.getClient();
    const manifestResponse = await getDestinyManifest(httpClient);
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
    const result = await getDestinyManifestSlice(httpClient, {
      destinyManifest: manifestResponse.Response,
      language: 'en',
      tableNames: [
        'DestinyInventoryItemDefinition',
        'DestinyInventoryBucketDefinition',
        'DestinyItemTierTypeDefinition',
        'DestinyStatDefinition',
        'DestinyDamageTypeDefinition',
        'DestinyItemCategoryDefinition',
        'DestinyPlugSetDefinition',
        'DestinySocketTypeDefinition',
        'DestinySocketCategoryDefinition',
      ],
    });
    if (!result.DestinyInventoryItemDefinition) {
      throw new Error('Could not read inventory definitions correctly');
    }
    if (!result.DestinyInventoryBucketDefinition) {
      throw new Error('Could not read bucket definitions correctly');
    }
    try {
      fs.writeFileSync(
        'debug/DestinyInventoryItemDefinitions.json',
        JSON.stringify(result.DestinyInventoryItemDefinition, null, 4),
      );
      fs.writeFileSync(
        'debug/DestinyInventoryBucketDefinitions.json',
        JSON.stringify(result.DestinyInventoryBucketDefinition, null, 4),
      );
      fs.writeFileSync(
        'debug/DestinyItemTierTypeDefinitions.json',
        JSON.stringify(result.DestinyItemTierTypeDefinition, null, 4),
      );
      fs.writeFileSync(
        'debug/DestinyStatDefinitions.json',
        JSON.stringify(result.DestinyStatDefinition, null, 4),
      );
      fs.writeFileSync(
        'debug/DestinyDamageTypeDefinitions.json',
        JSON.stringify(result.DestinyDamageTypeDefinition, null, 4),
      );
      fs.writeFileSync(
        'debug/DestinyItemCategoryDefinitions.json',
        JSON.stringify(result.DestinyItemCategoryDefinition, null, 4),
      );
      fs.writeFileSync(
        'debug/DestinyPlugSetDefinitions.json',
        JSON.stringify(result.DestinyPlugSetDefinition, null, 4),
      );
      fs.writeFileSync(
        'debug/DestinySocketTypeDefinitions.json',
        JSON.stringify(result.DestinySocketTypeDefinition, null, 4),
      );
      fs.writeFileSync(
        'debug/DestinySocketCategoryDefinitions.json',
        JSON.stringify(result.DestinySocketCategoryDefinition, null, 4),
      );
    } catch (e) {
      console.error(e);
    }

    inventoryDefinitions = result.DestinyInventoryItemDefinition;
    bucketDefinitions = result.DestinyInventoryBucketDefinition;
  } catch (e) {
    console.error('Fetching weapon data was not successful', e);
    ctx.status = 500;
    ctx.body = e;
    return;
  }
  try {
    const kineticBucketName = 'Kinetic Weapons';
    const energyBucketName = 'Energy Weapons';
    const powerBucketName = 'Power Weapons';
    const kineticBucketKey = Object.keys(bucketDefinitions).filter(
      (key) => bucketDefinitions[key].displayProperties.name === kineticBucketName,
    )[0];
    const kineticBucketHash = bucketDefinitions[kineticBucketKey]?.hash;
    if (!kineticBucketHash) {
      throw new Error('Could not decode the kinetic weapon bucket');
    }
    const energyBucketKey = Object.keys(bucketDefinitions).filter(
      (key) => bucketDefinitions[key].displayProperties.name === energyBucketName,
    )[0];
    const energyBucketHash = bucketDefinitions[energyBucketKey]?.hash;
    if (!energyBucketHash) {
      throw new Error('Could not decode the energy weapon bucket');
    }
    const powerBucketKey = Object.keys(bucketDefinitions).filter(
      (key) => bucketDefinitions[key].displayProperties.name === powerBucketName,
    )[0];
    const powerBucketHash = bucketDefinitions[powerBucketKey]?.hash;
    if (!powerBucketHash) {
      throw new Error('Could not decode the heavy weapon bucket');
    }
    Object.entries(inventoryDefinitions).map((inventoryObject) => {
      const inventoryItem = inventoryObject[1];
      const currentBucketHash = inventoryItem.inventory.bucketTypeHash;
      if (
        currentBucketHash === kineticBucketHash ||
        currentBucketHash === energyBucketHash ||
        currentBucketHash === powerBucketHash
      ) {
        weaponDefinitions.push(inventoryItem);
      }
      return inventoryItem;
    });
    ctx.status = 200;
  } catch (e) {
    console.error('Decoding weapon data was not successful', e);
    ctx.status = 500;
    ctx.body = e;
  }
};

export default weaponApi;
