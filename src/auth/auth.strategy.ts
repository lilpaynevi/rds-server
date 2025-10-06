
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Récupère le token dans le header Authorization
      ignoreExpiration: false,
      secretOrKey: 'yourSecretKey',  // Clé secrète utilisée pour vérifier le token
    });
  }

  async validate(payload: any) {
    return { userId: payload.sub, username: payload.username };
  }
}
