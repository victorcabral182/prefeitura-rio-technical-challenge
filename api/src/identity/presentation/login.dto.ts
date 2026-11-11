import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  // Limite evita que uma senha gigante vire custo de CPU no scrypt.
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  password!: string;
}
