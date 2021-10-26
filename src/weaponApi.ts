import * as fs from 'fs';
import Koa from 'koa';
import {
  DestinyInventoryBucketDefinition,
  DestinyInventoryItemDefinition,
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

export const weaponApi = async (ctx: Koa.Context) => {
  let bucketDefinitions: DestinyBucketDefinition;
  let inventoryDefinitions: DestinyInventoryDefinition;
  const kineticWeapons: DestinyInventoryItemDefinition[] = [];
  const energyWeapons: DestinyInventoryItemDefinition[] = [];
  const powerWeapons: DestinyInventoryItemDefinition[] = [];
  try {
    const httpClient = clientGenerator.getClient();
    const manifestResponse = await getDestinyManifest(httpClient);
    const result = await getDestinyManifestSlice(httpClient, {
      destinyManifest: manifestResponse.Response,
      language: 'en',
      tableNames: ['DestinyInventoryItemDefinition', 'DestinyInventoryBucketDefinition'],
    });
    if (!result.DestinyInventoryBucketDefinition) {
      throw new Error('Could not read bucket definitions correctly');
    }
    if (!result.DestinyInventoryItemDefinition) {
      throw new Error('Could not read inventory definitions correctly');
    }
    bucketDefinitions = result.DestinyInventoryBucketDefinition;
    inventoryDefinitions = result.DestinyInventoryItemDefinition;
  } catch (e) {
    console.error('Fetching weapon data was not successful', e);
    ctx.status = 500;
    ctx.body = e;
    return;
  }
  try {
    const kineticBucketKey = Object.keys(bucketDefinitions).filter(
      (key) => bucketDefinitions[key].displayProperties.name === 'Kinetic Weapons',
    )[0];
    const kineticBucketHash = bucketDefinitions[kineticBucketKey]?.hash;
    if (!kineticBucketHash) {
      throw new Error('Could not decode the kinetic weapon bucket');
    }
    const energyBucketKey = Object.keys(bucketDefinitions).filter(
      (key) => bucketDefinitions[key].displayProperties.name === 'Energy Weapons',
    )[0];
    const energyBucketHash = bucketDefinitions[energyBucketKey]?.hash;
    if (!energyBucketHash) {
      throw new Error('Could not decode the energy weapon bucket');
    }
    const powerBucketKey = Object.keys(bucketDefinitions).filter(
      (key) => bucketDefinitions[key].displayProperties.name === 'Power Weapons',
    )[0];
    const powerBucketHash = bucketDefinitions[powerBucketKey]?.hash;
    if (!powerBucketHash) {
      throw new Error('Could not decode the heavy weapon bucket');
    }
    Object.entries(inventoryDefinitions).map((inventoryObject) => {
      const inventoryItem = inventoryObject[1];
      switch (inventoryItem.inventory?.bucketTypeHash) {
        case kineticBucketHash:
          kineticWeapons.push(inventoryItem);
          break;
        case energyBucketHash:
          energyWeapons.push(inventoryItem);
          break;
        case powerBucketHash:
          powerWeapons.push(inventoryItem);
          break;
        default:
      }
      return inventoryItem;
    });
    ctx.status = 200;
  } catch (e) {
    console.error('Decoding weapon data was not successful', e);
    ctx.status = 500;
    ctx.body = e;
    return;
  }
  try {
    fs.writeFileSync('Kinetic.json', JSON.stringify(kineticWeapons));
    fs.writeFileSync('Energy.json', JSON.stringify(energyWeapons));
    fs.writeFileSync('Power.json', JSON.stringify(powerWeapons));
  } catch (e) {
    console.error('Writing weapon data was not successful', e);
    ctx.status = 500;
    ctx.body = e;
  }
};

export default weaponApi;
