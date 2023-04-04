import { Injectable } from '@nestjs/common';

@Injectable()
export class ValidatorsStorageService {
  protected validators: string[];
  protected lastUpdate: number;

  /**
   * Get all validators
   * @returns array of validators
   */
  public get(): any[] | null {
    return this.validators;
  }

  /**
   * Get last update timestamp
   * @returns last update timestamp
   */
  public getLastUpdate(): number | null {
    return this.lastUpdate;
  }

  /**
   * Updates all validators
   * @param validators - validators to save
   */
  public set(validators: any[]): void {
    this.validators = validators;
  }

  /**
   * Updates last update timestamp
   * @param lastUpdate - timestamp to save
   */
  public setLastUpdate(lastUpdate: number): void {
    this.lastUpdate = lastUpdate;
  }
}
