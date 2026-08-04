import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { QnaService } from './qna.service';
import { AskQuestionDto } from './dto/ask-question.dto';
import { AnswerQuestionDto } from './dto/answer-question.dto';
import { UpdateQuestionStatusDto } from './dto/update-question-status.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

@ApiTags('Q&A')
@Controller({ path: 'data-rooms/:dataRoomId/questions', version: '1' })
export class QnaController {
  constructor(private readonly qnaService: QnaService) {}

  @Get()
  list(
    @Param('dataRoomId') dataRoomId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Query('search') search?: string,
  ) {
    return this.qnaService.list(dataRoomId, user, search, req.ip ?? '0.0.0.0');
  }

  @Post()
  ask(
    @Param('dataRoomId') dataRoomId: string,
    @Body() dto: AskQuestionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.qnaService.ask(dataRoomId, dto.question, dto.isPrivate ?? false, user, req.ip ?? '0.0.0.0');
  }

  @Patch(':questionId/status')
  updateStatus(
    @Param('dataRoomId') dataRoomId: string,
    @Param('questionId') questionId: string,
    @Body() dto: UpdateQuestionStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.qnaService.updateStatus(dataRoomId, questionId, dto.status, user, req.ip ?? '0.0.0.0');
  }

  @Post(':questionId/answers')
  answer(
    @Param('dataRoomId') dataRoomId: string,
    @Param('questionId') questionId: string,
    @Body() dto: AnswerQuestionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.qnaService.answer(dataRoomId, questionId, dto.answer, user, req.ip ?? '0.0.0.0');
  }

  @Patch(':questionId/answers/:answerId')
  editAnswer(
    @Param('dataRoomId') dataRoomId: string,
    @Param('questionId') questionId: string,
    @Param('answerId') answerId: string,
    @Body() dto: AnswerQuestionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.qnaService.editAnswer(dataRoomId, questionId, answerId, dto.answer, user, req.ip ?? '0.0.0.0');
  }

  @Delete(':questionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteQuestion(
    @Param('dataRoomId') dataRoomId: string,
    @Param('questionId') questionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.qnaService.deleteQuestion(dataRoomId, questionId, user, req.ip ?? '0.0.0.0');
  }
}
