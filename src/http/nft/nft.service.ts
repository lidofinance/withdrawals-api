import { Inject, Injectable } from '@nestjs/common';
import { WithdrawalQueue, WITHDRAWAL_QUEUE_CONTRACT_TOKEN } from '@lido-nestjs/contracts';
import { ConfigService } from 'common/config';

import { NFTDto, NFTParamsDto, NFTOptionsDto } from './dto';
import { glyphNumbers, simpleNumbers } from './nft.assets';
import { gray } from './nft.background';
import { formatUnits } from 'ethers';

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

  convertFromWei(amountInWei): string {
    const amountInGwei = parseFloat(formatUnits(amountInWei.toString(), 'gwei'));
    const amountInEth = parseFloat(formatUnits(amountInWei.toString(), 'ether'));

    if (amountInEth >= 1) {
      return parseFloat(amountInEth.toFixed(6)) + ' ETH';
    } else if (amountInGwei >= 1) {
      return parseFloat(amountInGwei.toFixed(2)) + ' GWEI';
    } else {
      return amountInWei + ' WEI';
    }
  }

  // svg mock
  generateSvgImage(params: NFTParamsDto, query: NFTOptionsDto): string {
    // TODO: implement svg generation
    const { status, amount, created_at } = query;
    const tokenId = Number(params.tokenId);

    const convertedAmount = this.convertFromWei(amount);

    // function for generate amount on svg throw glyphNumbers
    const generateAmount = (amount: string) => {
      const amountString = amount.toString();
      let result = '';
      let space = 0;
      for (let i = 0; i < amountString.length; i++) {
        if (amountString[i - 1] === '1') space += 100;
        else space += 200;
        result += `<g transform="matrix(1,0,0,1,${space},0)" opacity="1" style="display: block;">${
          glyphNumbers[amountString[i]]
        }</g>`;
      }
      return result;
    };

    const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000" width="2000" height="2000"
  preserveAspectRatio="xMidYMid meet"
  style="width: 100%; height: 100%; transform: translate3d(0px, 0px, 0px);">
  <image width="2000px" height="2000px" preserveAspectRatio="xMidYMid slice" xlink:href="${gray}"></image>
  <g clip-path="url(#__lottie_element_172)"
  opacity="1" style="display: block;">
         <animateTransform attributeName="transform" attributeType="XML" type="translate" from="0 2000" to="0 0" begin="0s" dur="8s" repeatCount="indefinite"></animateTransform>
         <g transform="matrix(0,-1,1,0,0,0)" opacity="1" style="display: block;">
          <g transform="matrix(1,0,0,1,14,0)" opacity="1" style="display: block;">
          ${generateAmount(convertedAmount)}
          </g>
          </g>
          <g transform="matrix(0,-1,1,0,0,2000)" opacity="1" style="display: block;">
          <g transform="matrix(1,0,0,1,14,0)" opacity="1" style="display: block;">
          ${generateAmount(convertedAmount)}
          </g>
          </g>
         </g>
  <g clip-path="url(#__lottie_element_172)"
  opacity="1" style="display: block;">
         <animateTransform attributeName="transform" attributeType="XML" type="translate" from="0 0" to="0 2000" begin="0s" dur="8s" repeatCount="indefinite"></animateTransform>
         <g transform="matrix(0,-1,1,0,1880,0)" opacity="1" style="display: block;">
          <g transform="matrix(1,0,0,1,14,0)" opacity="1" style="display: block;">
          ${generateAmount(convertedAmount)}
          </g>
          </g>
          <g transform="matrix(0,-1,1,0,1880,2000)" opacity="1" style="display: block;">
          <g transform="matrix(1,0,0,1,14,0)" opacity="1" style="display: block;">
          ${generateAmount(convertedAmount)}
          </g>
          </g>
         </g>
         </svg>
    `;

    return svgString;
  }
}
