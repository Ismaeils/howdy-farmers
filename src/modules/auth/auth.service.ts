import * as bcrypt from "bcrypt";
import config from "config/config";
import { fromUnixTime } from "date-fns";
import { UnprocessableEntityError } from "errors/errors";
import { decode, sign } from "jsonwebtoken";
import { UsersService } from "modules/users/users.service";
import dataSource from "orm/orm.config";
import { Repository } from "typeorm";
import { LoginUserInputDto } from "./dto/login-user.input.dto";
import { AccessToken } from "./entities/access-token.entity";

export class AuthService {
  private readonly accessTokenRepository: Repository<AccessToken>;
  private readonly usersService: UsersService;

  constructor() {
    this.accessTokenRepository = dataSource.getRepository(AccessToken);
    this.usersService = new UsersService();
  }

  public async login(data: LoginUserInputDto): Promise<AccessToken> {
    const user = await this.usersService.findOneBy({ email: data.email });

    if (!user) throw new UnprocessableEntityError("Invalid user email or password");

    const isValidPassword = await this.validatePassword(data.password, user.hashedPassword);

    if (!isValidPassword) throw new UnprocessableEntityError("Invalid user email or password");

    const token = sign(
      {
        id: user.id,
        email: user.email,
      },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_AT },
    );
    const tokenExpireDate = this.getJwtTokenExpireDate(token);

    const newToken = this.accessTokenRepository.create({
      token,
      user,
      expiresAt: fromUnixTime(tokenExpireDate),
    });

    return this.accessTokenRepository.save(newToken);
  }

  public async getAccessToken(token: string): Promise<AccessToken> {
    return this.accessTokenRepository.findOneOrFail({ where: { token }, relations: ["user"] });
  }

  private getJwtTokenExpireDate(token: string): number {
    const { exp } = decode(token) as { [exp: string]: number };
    return exp;
  }

  private async validatePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }
}
