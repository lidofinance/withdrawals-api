import { Inject, Injectable } from '@nestjs/common';
import { WithdrawalQueue, WITHDRAWAL_QUEUE_CONTRACT_TOKEN } from '@lido-nestjs/contracts';
import { ConfigService } from 'common/config';

import { NFTDto, NFTParamsDto, NFTOptionsDto } from './dto';
import { glyphNumbers, simpleNumbers } from './nft.assets';

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
    // TODO: implement svg generation
    const { status, amount, created_at } = query;
    const tokenId = Number(params.tokenId);

    const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000" width="2000" height="2000"
  preserveAspectRatio="xMidYMid meet"
  style="width: 100%; height: 100%; transform: translate3d(0px, 0px, 0px);">
  <g clip-path="url(#__lottie_element_172)"
  opacity="1" style="display: block;">
         <animateTransform attributeName="transform" attributeType="XML" type="translate" from="0 0" to="0 2000" begin="0s" dur="5s" repeatCount="indefinite"></animateTransform>
         <g transform="matrix(1,0,0,1,14,120)" opacity="1" style="display: block;">
         ${glyphNumbers[tokenId % 10]}
</g>
         ${simpleNumbers[tokenId % 10]}
         </g>
         </svg>
    `;

    return svgString;
  }
}
