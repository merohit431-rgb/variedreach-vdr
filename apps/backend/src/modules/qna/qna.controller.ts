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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
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
  ) {
    return this.qnaService.list(dataRoomId, user);
  }

  @Post()
  ask(
    @Param('dataRoomId') dataRoomId: string,
    @Body() dto: AskQuestionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.qnaService.ask(dataRoomId, dto.question, dto.isPrivate ?? false, user);
  }

  @Patch(':questionId/status')
  updateStatus(
    @Param('dataRoomId') dataRoomId: string,
    @Param('questionId') questionId: string,
    @Body() dto: UpdateQuestionStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.qnaService.updateStatus(dataRoomId, questionId, dto.status, user);
  }

  @Post(':questionId/answers')
  answer(
    @Param('dataRoomId') dataRoomId: string,
    @Param('questionId') questionId: string,
    @Body() dto: AnswerQuestionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.qnaService.answer(dataRoomId, questionId, dto.answer, user);
  }

  @Patch(':questionId/answers/:answerId')
  editAnswer(
    @Param('dataRoomId') dataRoomId: string,
    @Param('questionId') questionId: string,
    @Param('answerId') answerId: string,
    @Body() dto: AnswerQuestionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.qnaService.editAnswer(dataRoomId, questionId, answerId, dto.answer, user);
  }

  @Delete(':questionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteQuestion(
    @Param('dataRoomId') dataRoomId: string,
    @Param('questionId') questionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.qnaService.deleteQuestion(dataRoomId, questionId, user);
  }
}
