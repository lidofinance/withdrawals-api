import { Inject, Injectable } from '@nestjs/common';
import { WithdrawalQueue, WITHDRAWAL_QUEUE_CONTRACT_TOKEN } from '@lido-nestjs/contracts';
import { ConfigService } from 'common/config';

import { NFTDto, NFTParamsDto, NFTOptionsDto } from './dto';

@Injectable()
export class NFTService {
  constructor(
    protected readonly configService: ConfigService,
    @Inject(WITHDRAWAL_QUEUE_CONTRACT_TOKEN) protected readonly contract: WithdrawalQueue,
  ) {}

  async getNftMeta(params: NFTParamsDto, query: NFTOptionsDto): Promise<NFTDto | null> {
    const name = await this.contract.name();
    const symbol = await this.contract.symbol();

    const meta = {
      name: name,
      description: symbol,
      image: `data:image/svg+xml;base64,${Buffer.from(this.generateSvgImage(params, query)).toString('base64')}`,
    };
    return meta;
  }

  async getNftImage(params: NFTParamsDto, query): Promise<string> {
    return this.generateSvgImage(params, query);
  }

  // svg mock
  generateSvgImage(params: NFTParamsDto, query: NFTOptionsDto): string {
    const { status, amount, created_at } = query;
    const tokenId = Number(params.tokenId);

    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
        <rect width="100%" height="100%" fill="#${Math.floor(Math.random() * 16777215).toString(16)}" />
        <rect x="50" y="50" width="200" height="200" fill="#${Math.floor(Math.random() * 16777215).toString(16)}" />
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="32">NFT #${tokenId}</text>
        <text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle" font-size="16">Status: ${status}</text>
        <text x="50%" y="70%" dominant-baseline="middle" text-anchor="middle" font-size="16">Amount: ${amount}</text>
        <text x="50%" y="80%" dominant-baseline="middle" text-anchor="middle" font-size="16">Created: ${created_at}</text>
        <animateTransform
          attributeName="transform"
          attributeType="XML"
          type="rotate"
          from="0 0 0"
          to="360 0 0"
          begin="0s"
          dur="15s"
          repeatCount="indefinite"
        />
      </svg>
    `;

    return svgString;
  }
}
