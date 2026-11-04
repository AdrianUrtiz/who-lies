import {
  IsIn,
  IsString,
  IsUUID,
  Length,
  Matches,
  registerDecorator,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator'
import { Transform } from 'class-transformer'
import { CATEGORY_IDS } from '../../constants/characters'

@ValidatorConstraint({ name: 'isNotSameAs', async: false })
class IsNotSameAsConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const [relatedProperty] = args.constraints as [string]
    return value !== (args.object as Record<string, unknown>)[relatedProperty]
  }

  defaultMessage(args: ValidationArguments): string {
    const [relatedProperty] = args.constraints as [string]
    return `${args.property} must not equal ${relatedProperty}`
  }
}

/** Valida que la propiedad decorada no sea igual a otra del mismo objeto. */
export function IsNotEqualTo(
  relatedProperty: string,
  validationOptions?: ValidationOptions,
) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [relatedProperty],
      validator: IsNotSameAsConstraint,
    })
  }
}

export class CreateRoomDto {
  @IsString()
  @IsIn(CATEGORY_IDS, { message: 'INVALID_CATEGORY' })
  categoryId!: string

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(1, 20, { message: 'INVALID_NAME' })
  hostName!: string
}

export class JoinRoomDto {
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Length(6, 6, { message: 'INVALID_CODE' })
  @Matches(/^[A-Z0-9]{6}$/, { message: 'INVALID_CODE' })
  code!: string

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(1, 20, { message: 'INVALID_NAME' })
  playerName!: string
}

export class RoomIdDto {
  @IsUUID('4', { message: 'INVALID_ROOM_ID' })
  roomId!: string
}

/** P1-B1: reentrada con el mismo asiento (sin crear Player duplicado). */
export class RejoinDto {
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Length(6, 6, { message: 'INVALID_CODE' })
  @Matches(/^[A-Z0-9]{6}$/, { message: 'INVALID_CODE' })
  code!: string

  @IsUUID('4', { message: 'INVALID_PLAYER_ID' })
  playerId!: string
}

export class PlayerActionDto {
  @IsUUID('4', { message: 'INVALID_ROOM_ID' })
  roomId!: string

  @IsUUID('4', { message: 'INVALID_PLAYER_ID' })
  playerId!: string
}

/** Acciones solo-host: mutan el estado del juego (P0-T5). */
export class HostRoomDto {
  @IsUUID('4', { message: 'INVALID_ROOM_ID' })
  roomId!: string

  @IsUUID('4', { message: 'INVALID_PLAYER_ID' })
  requesterPlayerId!: string
}

export class VoteDto {
  @IsUUID('4', { message: 'INVALID_ROOM_ID' })
  roomId!: string

  @IsUUID('4', { message: 'INVALID_PLAYER_ID' })
  voterId!: string

  @IsUUID('4', { message: 'INVALID_PLAYER_ID' })
  @IsNotEqualTo('voterId', { message: 'CANNOT_VOTE_SELF' })
  votedForId!: string
}
