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
    console.log('initializeManifest');
    try {
      const manifestResponse = await getDestinyManifest(this.httpClient);
      return manifestResponse.Response;
    } catch (e) {
      console.error('initializeManifest: initializing the Destiny manifest failed', e);
      throw e;
    }
  };

  private initializeDefinitionData = async () => {
    console.log('initializeDefinitionData');
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
        tableNames: ['DestinyInventoryItemDefinition', 'DestinyInventoryBucketDefinition'],
      });
    } catch (e) {
      console.error('initializeDefinitionData: initializing definition data failed', e);
      throw e;
    }
  };

  private initializeWeaponData = async () => {
    console.log('initializeWeaponData');
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

  public getWeaponDefinitions = async () => this.weaponDefinitions;
}

export default WeaponManager;
