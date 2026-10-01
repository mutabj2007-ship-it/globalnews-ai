import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { alertsInAppEnabled, discussionReadEnabled, discussionWriteEnabled } from './story-gates';

/**
 * The Stage B gates as the FIRST guard of each route, so a disabled capability answers 404
 * before authentication is even consulted (a signed-out probe learns nothing either way).
 */
@Injectable()
export class DiscussionReadGate implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(): boolean {
    if (!discussionReadEnabled(this.config)) throw new NotFoundException();
    return true;
  }
}

@Injectable()
export class DiscussionWriteGate implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(): boolean {
    if (!discussionWriteEnabled(this.config)) throw new NotFoundException();
    return true;
  }
}

@Injectable()
export class AlertsInAppGate implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(): boolean {
    if (!alertsInAppEnabled(this.config)) throw new NotFoundException();
    return true;
  }
}
