import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFiles,
  UseGuards,
} from '@nestjs/common';
import { GetUser } from 'src/decorator/get-user.decorator';
import { JwtAuthGuard } from 'src/auth/auth.guard';
import { MailService } from './mail.service';

@Controller('mail')
export class MailController {
  constructor(private mailService: MailService) {}

  @UseGuards(JwtAuthGuard)
  @Post('/forgot-password')
  async forgotPassword(@Body() dataUser: any, @GetUser() user: any) {
    return this.mailService.sendPasswordChangedConfirmation(dataUser.email, "")
  }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.mailServiceMailService.remove(+id);
  // }
}
