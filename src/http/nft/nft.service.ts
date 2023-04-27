import { Inject, Injectable } from '@nestjs/common';
import { WithdrawalQueue, WITHDRAWAL_QUEUE_CONTRACT_TOKEN } from '@lido-nestjs/contracts';
import { ConfigService } from 'common/config';
import { QueueInfoStorageService } from 'storage';

import { phrase, bgTwo, bgOne, lidoGray, ethColor } from './assets/nft.parts';
import { convertFromWei } from './nft.utils';
import {
  generateCrystallSvg,
  getCrystallSvgByAmount,
  generateAmountLineSvg,
  generateIdSvg,
  generateDateSvg,
} from './nft.svg.utils';
import { META_DATA_DESC, META_DATA_NAME } from './nft.constants';
import { NFTDto, NFTParamsDto, NFTOptionsDto } from './dto';

const ALLOWED_ID_LIST = [74, 415, 82, 92, 93, 489, 415, 414, 413, 210];

@Injectable()
export class NFTService {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly queueInfo: QueueInfoStorageService,
    @Inject(WITHDRAWAL_QUEUE_CONTRACT_TOKEN) protected readonly contract: WithdrawalQueue,
  ) {}

  async getNftMeta(params: NFTParamsDto, query: NFTOptionsDto): Promise<NFTDto | null> {
    const { tokenId } = params;

    const image = ALLOWED_ID_LIST.includes(Number(params.tokenId))
      ? `data:image/svg+xml;base64,${Buffer.from(this.generateSvgImage(params, query)).toString('base64')}`
      : null;

    const meta = {
      name: `${META_DATA_NAME} #${tokenId}`,
      description: META_DATA_DESC,
      image,
    };
    return meta;
  }

  async getNftImage(params: NFTParamsDto, query): Promise<string> {
    return this.generateSvgImage(params, query);
  }

  generateSvgImage(params: NFTParamsDto, query: NFTOptionsDto): string {
    const { requested, created_at, finalized } = query;
    const tokenId = Number(params.tokenId);
    const isPending = !finalized;
    const prefix = isPending ? 'ST' : '';
    const amount = isPending ? requested : finalized;

    const crystall = getCrystallSvgByAmount(amount);
    const convertedAmount = convertFromWei(amount, prefix);

    const token = isPending ? lidoGray : ethColor;
    const bg = isPending ? bgTwo : bgOne;
    const textColor = isPending ? '#8393AC' : crystall.claimedColor;

    const left = generateAmountLineSvg(convertedAmount, 0);
    const right = generateAmountLineSvg(convertedAmount, 1880);
    const id = generateIdSvg(tokenId.toString());
    const date = generateDateSvg(created_at);

    const lineAnimationDuration = 22;

    const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000" width="2000" height="2000"
  preserveAspectRatio="xMidYMid meet" style="width: 100%; height: 100%; transform: translate3d(0px, 0px, 0px);">
      <defs>
        <clipPath id="content"><rect width="2000" height="2000" x="0" y="0" rx="20"></rect></clipPath>
      </defs>
      <g clip-path="url(#content)">
        ${bg}
        ${token}
        <g fill="${textColor}">
          <animateTransform attributeName="transform" attributeType="XML" type="translate" from="0 ${
            left.size * 2 + 200 * 2
          }"
          to="0 0" begin="0s" dur="${lineAnimationDuration}s" repeatCount="indefinite"/>
          ${left.line}
        </g>
        <g fill="${textColor}">
          <animateTransform attributeName="transform" attributeType="XML" type="translate" from="0 0" to="0 ${
            right.size * 2 + 200 * 2
          }" begin="0s" dur="${lineAnimationDuration}s" repeatCount="indefinite"/>
            ${right.line}
        </g>
        <g transform="matrix(1,0,0,1,950,1630)" fill="${textColor}">
          ${phrase}
        </g>
        ${generateCrystallSvg(crystall.svg, 'M 150 -300 50 -50 z', crystall.positions[0], textColor)}
        ${generateCrystallSvg(crystall.svg, 'M 200 -200 0 -0 z', crystall.positions[1], textColor)}
        ${generateCrystallSvg(crystall.svg, 'M 0 0 -150 -200 z', crystall.positions[2], textColor, -1, -1)}
        ${generateCrystallSvg(crystall.svg, 'M 0 0 150 -350 z', crystall.positions[3], textColor, -1)}
        <g transform="matrix(1,0,0,1,301,899)" fill="${textColor}">${id.result}</g>
        <g transform="matrix(1,0,0,1,1194,96)" fill="${textColor}">${date.result}</g>
      </g>
    </svg>
    `;

    return svgString;
  }
}
