import * as THREE from "three";

export class SpatialGrid<T extends { pos: THREE.Vector3 }> {
  private cellSize: number;
  private grid: Map<string, T[]> = new Map();
  private items: T[] = [];

  constructor(private bounds: { min: THREE.Vector3; max: THREE.Vector3 }, cellSize: number = 20) {
    this.cellSize = cellSize;
  }

  add(item: T): void {
    this.items.push(item);
    this.updateItem(item);
  }

  updateItem(item: T): void {
    const key = this.getCellKey(item.pos);
    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    
    // Remove from previous cell (if any)
    for (const [cellKey, cellItems] of this.grid) {
      const index = cellItems.indexOf(item);
      if (index !== -1) {
        cellItems.splice(index, 1);
        if (cellItems.length === 0) {
          this.grid.delete(cellKey);
        }
        break;
      }
    }
    
    // Add to new cell
    this.grid.get(key)?.push(item);
  }

  remove(item: T): void {
    const index = this.items.indexOf(item);
    if (index !== -1) {
      this.items.splice(index, 1);
    }
    
    for (const [cellKey, cellItems] of this.grid) {
      const index = cellItems.indexOf(item);
      if (index !== -1) {
        cellItems.splice(index, 1);
        if (cellItems.length === 0) {
          this.grid.delete(cellKey);
        }
        break;
      }
    }
  }

  clear(): void {
    this.grid.clear();
    this.items = [];
  }

  queryNearby(position: THREE.Vector3, radius: number): T[] {
    const result: T[] = [];
    const minCell = this.getCellCoordinates(position.clone().subScalar(radius));
    const maxCell = this.getCellCoordinates(position.clone().addScalar(radius));
    
    for (let x = minCell.x; x <= maxCell.x; x++) {
      for (let z = minCell.z; z <= maxCell.z; z++) {
        const key = this.getCellKeyFromCoords(x, z);
        const cellItems = this.grid.get(key);
        if (cellItems) {
          result.push(...cellItems);
        }
      }
    }
    
    return result;
  }

  queryAll(): T[] {
    return this.items;
  }

  private getCellKey(position: THREE.Vector3): string {
    const coords = this.getCellCoordinates(position);
    return this.getCellKeyFromCoords(coords.x, coords.z);
  }

  private getCellKeyFromCoords(x: number, z: number): string {
    return `${x},${z}`;
  }

  private getCellCoordinates(position: THREE.Vector3): { x: number; z: number } {
    return {
      x: Math.floor((position.x - this.bounds.min.x) / this.cellSize),
      z: Math.floor((position.z - this.bounds.min.z) / this.cellSize)
    };
  }

  getStats(): { cellCount: number; itemCount: number } {
    return {
      cellCount: this.grid.size,
      itemCount: this.items.length
    };
  }
}
