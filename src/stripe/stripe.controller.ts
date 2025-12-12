import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  RawBodyRequest,
  Req,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { StripeService } from './stripe.service';
import { CreateStripeDto } from './dto/create-stripe.dto';
import { UpdateStripeDto } from './dto/update-stripe.dto';
import { JwtAuthGuard } from 'src/auth/auth.guard';
import { GetUser } from 'src/decorator/get-user.decorator';

@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) { }

  @Post('webhook')
  async handleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Req() response: RawBodyRequest<Response>,
  ) {
    try {
      let event = request.body
      return await this.stripeService.handleWebhook(event);
    } catch (error) {
      console.error(`❌ Erreur webhook controller: ${error.message}`);
      throw error;
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    // Logique pour créer une session checkout
    return this.stripeService.findOne(id);
  }

  @Get('/subscriptions')
  async findAll() {
    return this.stripeService.findAll();
  }

  @Post('create-checkout-session')
  async createCheckoutSession(@Body() body: any) {
    return this.stripeService.createCheckoutSession(body);
  }

  @Post('update-checkout-session')
  async updateCheckoutSession(@Body() body: any) {
    return this.stripeService.updateCheckoutSession(body);
  }

  @Post('cancel-subscription')
  async cancelSubscription(@Body() body: any) {
    return this.stripeService.cancelSubscription(body)
  }

  @Post('/create-payment-intent')
  async createPaymentIntent(@Body() body: { subPlanId: string }) {
    console.log('🚀 ~ StripeController ~ createPaymentIntent ~ body:', body);
    return this.stripeService.createPaymentIntent(body.subPlanId);
  }
}
